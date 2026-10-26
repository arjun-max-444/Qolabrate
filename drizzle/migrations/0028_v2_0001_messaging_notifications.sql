alter table public.v2_profiles
  add column if not exists dm_permission text not null default 'everyone',
  add column if not exists collab_permission text not null default 'everyone',
  add column if not exists show_email boolean not null default false,
  add column if not exists contact_email text;
alter table public.v2_profiles
  add constraint profiles_dm_permission_check check (dm_permission in ('everyone','following','nobody')),
  add constraint profiles_collab_permission_check check (collab_permission in ('everyone','following','nobody')),
  add constraint profiles_contact_email_check check (contact_email is null or char_length(contact_email) <= 200);

create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.v2_user_roles where user_id = _uid and role in ('admin','moderator'))
$$;

create or replace function public.rate_limit(_table text, _col text, _uid uuid, _max int, _window interval)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2', _table, _col)
    into n using _uid, _window;
  if n >= _max then
    raise exception 'You''re doing that too fast. Please wait a moment and try again.';
  end if;
end $$;
revoke execute on function public.rate_limit(text, text, uuid, int, interval) from public, anon, authenticated;

create table public.blocks (
  blocker_id uuid not null references public.v2_profiles(id) on delete cascade,
  blocked_id uuid not null references public.v2_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "See own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "Block as self" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "Unblock as self" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.on_block_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows where (follower_id = new.blocker_id and following_id = new.blocked_id)
    or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return null;
end $$;
create trigger blocks_cleanup after insert on public.blocks for each row execute function public.on_block_created();

drop policy if exists "Follow as self" on public.follows;
create policy "Follow as self" on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked_between(follower_id, following_id));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.v2_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','post','comment','message','campaign')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','impersonation','scam','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references public.v2_profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at desc);
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "Report as self" on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "See own reports or staff" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Staff resolve reports" on public.reports for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create or replace function public.reports_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.rate_limit('reports', 'reporter_id', new.reporter_id, 10, interval '1 hour');
  else
    new.reporter_id = old.reporter_id; new.target_type = old.target_type; new.target_id = old.target_id;
    new.reason = old.reason; new.details = old.details; new.created_at = old.created_at;
    if new.status <> 'open' and old.status = 'open' then new.resolved_by = auth.uid(); new.resolved_at = now(); end if;
  end if;
  return new;
end $$;
create trigger reports_guard before insert or update on public.reports for each row execute function public.reports_guard();

create policy "Staff remove posts" on public.posts for delete to authenticated using (public.is_staff(auth.uid()));
create policy "Staff remove comments" on public.comments for delete to authenticated using (public.is_staff(auth.uid()));

create or replace function public.admin_set_verified(_user uuid, _verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can verify accounts.'; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles set verified = _verified where id = _user;
  perform set_config('qola.internal', 'off', true);
end $$;
revoke execute on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

create table public.v2_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.v2_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  url text check (url is null or char_length(url) <= 300),
  cover_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index portfolio_owner_idx on public.v2_portfolio_items (owner_id, created_at desc);
grant select, insert, update, delete on public.v2_portfolio_items to authenticated;
grant all on public.v2_portfolio_items to service_role;
alter table public.v2_portfolio_items enable row level security;
create policy "Portfolio readable" on public.v2_portfolio_items for select to authenticated using (true);
create policy "Add own portfolio" on public.v2_portfolio_items for insert to authenticated with check (owner_id = auth.uid());
create policy "Edit own portfolio" on public.v2_portfolio_items for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Delete own portfolio" on public.v2_portfolio_items for delete to authenticated using (owner_id = auth.uid());

create table public.v2_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  actor_id uuid references public.v2_profiles(id) on delete cascade,
  type text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text unique
);
create index notifications_user_idx on public.v2_notifications (user_id, created_at desc);
grant select, delete on public.v2_notifications to authenticated;
grant update (read_at) on public.v2_notifications to authenticated;
grant all on public.v2_notifications to service_role;
alter table public.v2_notifications enable row level security;
create policy "Own notifications" on public.v2_notifications for select to authenticated using (user_id = auth.uid());
create policy "Mark own notifications" on public.v2_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Dismiss own notifications" on public.v2_notifications for delete to authenticated using (user_id = auth.uid());

create table public.notification_preferences (
  user_id uuid primary key references public.v2_profiles(id) on delete cascade,
  in_app boolean not null default true,
  email boolean not null default false,
  messages boolean not null default true,
  collaboration boolean not null default true,
  social boolean not null default true,
  campaigns boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy "Own prefs read" on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy "Own prefs insert" on public.notification_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "Own prefs update" on public.notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.v2_notify(_user uuid, _actor uuid, _type text, _body text, _link text, _key text)
returns void language plpgsql security definer set search_path = public as $$
declare cat text; p public.notification_preferences;
begin
  if _user is null or _user = _actor then return; end if;
  if _actor is not null and public.is_blocked_between(_user, _actor) then return; end if;
  cat := case
    when _type in ('follow','like','comment','reply','mention','repost') then 'social'
    when _type = 'message' then 'messages'
    when _type in ('invite','application','application_status') then 'campaigns'
    when _type in ('collab_status','task','deliverable') then 'collaboration'
    else 'system' end;
  select * into p from public.notification_preferences where user_id = _user;
  if found and cat <> 'system' then
    if not p.in_app then return; end if;
    if cat = 'social' and not p.social then return; end if;
    if cat = 'messages' and not p.messages then return; end if;
    if cat = 'campaigns' and not p.campaigns then return; end if;
    if cat = 'collaboration' and not p.collaboration then return; end if;
  end if;
  insert into public.v2_notifications (user_id, actor_id, type, body, link, dedupe_key)
  values (_user, _actor, _type, left(_body, 300), _link, _key)
  on conflict (dedupe_key) do update
    set read_at = null, created_at = now(), body = excluded.body, actor_id = excluded.actor_id, link = excluded.link;
end $$;
revoke execute on function public.v2_notify(uuid, uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.notify_social()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; uname text; parent_author uuid; m text;
begin
  if tg_table_name = 'follows' then
    select username into uname from public.v2_profiles where id = new.follower_id;
    perform public.v2_notify(new.following_id, new.follower_id, 'follow', 'started following you', '/u/' || coalesce(uname, 'me'), 'follow:' || new.follower_id || ':' || new.following_id);
  elsif tg_table_name = 'likes' then
    select author_id into author from public.posts where id = new.post_id;
    perform public.v2_notify(author, new.user_id, 'like', 'liked your post', '/post/' || new.post_id, 'like:' || new.user_id || ':' || new.post_id);
  elsif tg_table_name = 'reposts' then
    select author_id into author from public.posts where id = new.post_id;
    perform public.v2_notify(author, new.user_id, 'repost', 'reposted your post', '/post/' || new.post_id, 'repost:' || new.user_id || ':' || new.post_id);
  elsif tg_table_name = 'comments' then
    select author_id into author from public.posts where id = new.post_id;
    if new.parent_id is not null then
      select author_id into parent_author from public.comments where id = new.parent_id;
      perform public.v2_notify(parent_author, new.author_id, 'reply', 'replied: ' || new.body, '/post/' || new.post_id, 'reply:' || new.id);
    end if;
    if author is distinct from parent_author then
      perform public.v2_notify(author, new.author_id, 'comment', 'commented: ' || new.body, '/post/' || new.post_id, 'comment:' || new.id);
    end if;
    for m in select distinct lower(x[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,20})', 'g') as x loop
      perform public.v2_notify((select id from public.v2_profiles where username = m), new.author_id, 'mention', 'mentioned you in a reply', '/post/' || new.post_id, 'mention:c:' || new.id || ':' || m);
    end loop;
  elsif tg_table_name = 'posts' then
    for m in select distinct lower(x[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,20})', 'g') as x loop
      perform public.v2_notify((select id from public.v2_profiles where username = m), new.author_id, 'mention', 'mentioned you in a post', '/post/' || new.id, 'mention:p:' || new.id || ':' || m);
    end loop;
  end if;
  return null;
end $$;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_social();
create trigger likes_notify after insert on public.likes for each row execute function public.notify_social();
create trigger reposts_notify after insert on public.reposts for each row execute function public.notify_social();
create trigger comments_notify after insert on public.comments for each row execute function public.notify_social();
create trigger posts_notify after insert on public.posts for each row execute function public.notify_social();

create or replace function public.content_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'posts' then
    perform public.rate_limit('posts', 'author_id', new.author_id, 10, interval '5 minutes');
  elsif tg_table_name = 'comments' then
    perform public.rate_limit('comments', 'author_id', new.author_id, 20, interval '5 minutes');
  elsif tg_table_name = 'messages' then
    perform public.rate_limit('messages', 'sender_id', new.sender_id, 30, interval '1 minute');
  end if;
  return new;
end $$;
create trigger posts_rate before insert on public.posts for each row execute function public.content_rate_limit();
create trigger comments_rate before insert on public.comments for each row execute function public.content_rate_limit();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_sender_id uuid references public.v2_profiles(id) on delete set null
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.v2_profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  attachments jsonb not null default '[]'::jsonb,
  reply_to uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or jsonb_array_length(attachments) > 0 or deleted_at is not null)
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);

create or replace function public.is_conversation_member(_conv uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = _conv and user_id = _uid)
$$;

grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "Members read conversations" on public.conversations for select to authenticated using (public.is_conversation_member(id, auth.uid()));

grant select on public.conversation_members to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
grant all on public.conversation_members to service_role;
alter table public.conversation_members enable row level security;
create policy "Members see members" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "Mark own read" on public.conversation_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert on public.messages to authenticated;
grant update (deleted_at) on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "Members read messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "Members send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id, auth.uid())
  and not exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.user_id <> auth.uid() and public.is_blocked_between(auth.uid(), m.user_id)
  )
);
create policy "Delete own messages" on public.messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create trigger messages_rate before insert on public.messages for each row execute function public.content_rate_limit();

create or replace function public.messages_soft_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.deleted_at is null then raise exception 'Messages can only be deleted, not edited.'; end if;
  new.body = ''; new.attachments = '[]'::jsonb;
  return new;
end $$;
create trigger messages_soft_delete before update on public.messages for each row execute function public.messages_soft_delete();

create or replace function public.on_message_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; preview text;
begin
  preview := left(coalesce(nullif(new.body, ''), 'Sent an attachment'), 140);
  update public.conversations set last_message_at = new.created_at, last_message_preview = preview, last_sender_id = new.sender_id where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  for r in select user_id from public.conversation_members where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    perform public.v2_notify(r.user_id, new.sender_id, 'message', preview, '/messages/' || new.conversation_id, 'message:' || new.conversation_id || ':' || r.user_id);
  end loop;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message_created();

create or replace function public.start_conversation(_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid; perm text;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if _other = me then raise exception 'You can''t message yourself.'; end if;
  select c.conversation_id into conv
  from public.conversation_members c
  join public.conversation_members o on o.conversation_id = c.conversation_id and o.user_id = _other
  where c.user_id = me
    and (select count(*) from public.conversation_members x where x.conversation_id = c.conversation_id) = 2
  limit 1;
  if conv is not null then return conv; end if;
  if public.is_blocked_between(me, _other) then raise exception 'You can''t message this account.'; end if;
  select dm_permission into perm from public.v2_profiles where id = _other;
  if not found then raise exception 'Account not found.'; end if;
  if perm = 'nobody' then raise exception 'This account isn''t accepting messages.'; end if;
  if perm = 'following' and not exists (select 1 from public.follows where follower_id = _other and following_id = me) then
    raise exception 'This account only accepts messages from people they follow.';
  end if;
  insert into public.conversations default values returning id into conv;
  insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, _other);
  return conv;
end $$;
revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

create or replace function public.my_unread_counts()
returns table (conversation_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, count(msg.id)
  from public.conversation_members m
  join public.messages msg on msg.conversation_id = m.conversation_id
    and msg.created_at > m.last_read_at and msg.sender_id <> m.user_id and msg.deleted_at is null
  where m.user_id = auth.uid()
  group by m.conversation_id
$$;
revoke execute on function public.my_unread_counts() from public, anon;
grant execute on function public.my_unread_counts() to authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.v2_notifications;