create or replace function public.posts_creator_only()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if not (public.is_creator(new.author_id) or public.is_brand(new.author_id)) then
    perform public.account_event(new.author_id, 'blocked', 'Tried to post in the feed without a chosen account type');
    raise exception 'Choose Creator or Brand before posting.';
  end if;
  return new;
end $$;

create or replace function public.public_feed(_category text default null, _q text default null, _sort text default 'latest', _offset integer default 0, _limit integer default 15)
returns table(id uuid, body text, media jsonb, category text, post_type text, is_demo boolean, like_count integer, comment_count integer, repost_count integer, created_at timestamptz, campaign_id uuid, author jsonb)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.body, p.media, p.category, p.post_type, p.is_demo, p.like_count, p.comment_count, p.repost_count, p.created_at, p.campaign_id,
    jsonb_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url,
      'verified', a.verified, 'account_type', a.account_type, 'is_demo', a.is_demo)
  from public.posts p join public.v2_profiles a on a.id = p.author_id
  where p.visibility = 'public' and a.onboarded and a.account_type in ('creator', 'brand')
    and (_category is null or p.category = _category)
    and (_q is null or btrim(_q) = '' or p.body ilike '%' || left(btrim(_q), 80) || '%')
  order by
    case when _sort = 'trending' then (p.engagement_score + 1) / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.2) end desc nulls last,
    p.created_at desc
  limit least(greatest(_limit, 1), 30) offset greatest(_offset, 0)
$$;

create or replace function public.trending_post_ids(_category text default null, _offset integer default 0, _limit integer default 15)
returns setof uuid language sql stable set search_path to 'public' as $$
  select p.id from public.posts p join public.v2_profiles a on a.id = p.author_id
  where p.visibility = 'public' and a.account_type in ('creator', 'brand') and (_category is null or p.category = _category)
  order by (p.engagement_score + 1) / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.2) desc, p.created_at desc
  limit least(greatest(_limit, 1), 50) offset greatest(_offset, 0)
$$;

alter table public.messages add column if not exists is_automated boolean not null default false;

create or replace function public.messages_automated_guard()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    if tg_op = 'INSERT' then new.is_automated := false; else new.is_automated := old.is_automated; end if;
  end if;
  return new;
end $$;
drop trigger if exists messages_automated_guard on public.messages;
create trigger messages_automated_guard before insert or update on public.messages
  for each row execute function public.messages_automated_guard();

create or replace function public.v2_demo_auto_reply()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  demo record; n int; prev text := coalesce(current_setting('qola.internal', true), 'off'); reply text; first_name text;
begin
  if new.is_automated or new.deleted_at is not null then return null; end if;
  if exists (select 1 from public.v2_profiles where id = new.sender_id and is_demo) then return null; end if;
  if exists (select 1 from public.conversations where id = new.conversation_id and campaign_id is not null) then return null; end if;
  if (select count(*) from public.conversation_members where conversation_id = new.conversation_id) <> 2 then return null; end if;
  select p.id, p.display_name, p.account_type into demo
  from public.conversation_members m join public.v2_profiles p on p.id = m.user_id
  where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id and p.is_demo;
  if not found then return null; end if;
  select count(*) into n from public.messages
  where conversation_id = new.conversation_id and is_automated and created_at > now() - interval '1 day';
  if n >= 20 then return null; end if;
  first_name := split_part(demo.display_name, ' ', 1);
  if n = 0 then
    reply := case when demo.account_type = 'brand'
      then 'Hi! Thanks for messaging ' || demo.display_name || '. This is a sample brand account on Qolabrate, so nobody reads messages here. Real brands reply from their own accounts; browse open campaigns to start a real collaboration.'
      else 'Hey, thanks for the message! I''m ' || first_name || ', a sample creator account on Qolabrate, so a real person won''t see this. Messages with real creators work exactly like this chat.' end;
  else
    reply := (array[
      'Got it! Just a reminder: this is an automated reply from a sample account.',
      'Thanks! This sample account can''t read messages, but your chat history is saved here.',
      'Noted. Sample accounts only send automated replies like this one.',
      'Appreciate it! Try messaging a real ' || case when demo.account_type = 'brand' then 'brand' else 'creator' end || ' to start a collaboration.'
    ])[1 + (n % 4)];
  end if;
  begin
    perform set_config('qola.internal', 'on', true);
    insert into public.messages (conversation_id, sender_id, body, is_automated, created_at)
    values (new.conversation_id, demo.id, reply, true, clock_timestamp());
    perform set_config('qola.internal', prev, true);
  exception when others then
    perform set_config('qola.internal', prev, true);
  end;
  return null;
end $$;
drop trigger if exists messages_demo_auto_reply on public.messages;
create trigger messages_demo_auto_reply after insert on public.messages
  for each row execute function public.v2_demo_auto_reply();

create or replace function public.start_conversation(_other uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); conv uuid; perm text; demo boolean;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if _other = me then raise exception 'You can''t message yourself.'; end if;
  select c.conversation_id into conv
  from public.conversation_members c
  join public.conversation_members o on o.conversation_id = c.conversation_id and o.user_id = _other
  join public.conversations cv on cv.id = c.conversation_id and cv.campaign_id is null
  where c.user_id = me
    and (select count(*) from public.conversation_members x where x.conversation_id = c.conversation_id) = 2
  limit 1;
  if conv is not null then return conv; end if;
  if public.is_blocked_between(me, _other) then raise exception 'You can''t message this account.'; end if;
  select dm_permission, is_demo into perm, demo from public.v2_profiles where id = _other;
  if not found then raise exception 'Account not found.'; end if;
  if not demo then
    if perm = 'nobody' then raise exception 'This account isn''t accepting messages.'; end if;
    if perm = 'following' and not exists (select 1 from public.follows where follower_id = _other and following_id = me) then
      raise exception 'This account only accepts messages from people they follow.';
    end if;
  end if;
  insert into public.conversations default values returning id into conv;
  insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, _other);
  return conv;
end $$;

create table if not exists public.demo_library (
  kind text not null check (kind in ('profile', 'post_author', 'post_drop', 'post_new', 'comment_new', 'post_media')),
  key uuid not null,
  data jsonb not null default '{}'::jsonb,
  primary key (kind, key)
);
grant all on public.demo_library to service_role;
alter table public.demo_library enable row level security;

create or replace function public.demo_apply_library()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a int; b int; c int; d int; e int; f int;
begin
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles p set
    bio = coalesce(l.data->>'bio', p.bio),
    headline = coalesce(l.data->>'headline', p.headline),
    avatar_url = coalesce(l.data->>'avatar_url', p.avatar_url),
    cover_url = coalesce(l.data->>'cover_url', p.cover_url)
  from public.demo_library l where l.kind = 'profile' and l.key = p.id and p.is_demo;
  get diagnostics a = row_count;
  update public.posts p set author_id = (l.data->>'author_id')::uuid
  from public.demo_library l
  where l.kind = 'post_author' and l.key = p.id and p.is_demo
    and exists (select 1 from public.v2_profiles x where x.id = (l.data->>'author_id')::uuid and x.is_demo);
  get diagnostics b = row_count;
  delete from public.posts p using public.demo_library l where l.kind = 'post_drop' and l.key = p.id and p.is_demo;
  get diagnostics c = row_count;
  insert into public.posts (id, author_id, body, media, visibility, like_count, repost_count, created_at, is_demo, category, post_type)
  select l.key, (l.data->>'author_id')::uuid, l.data->>'body', coalesce(l.data->'media', '[]'::jsonb), 'public',
    (l.data->>'like_count')::int, (l.data->>'repost_count')::int, (l.data->>'created_at')::timestamptz, true,
    l.data->>'category', coalesce(l.data->>'post_type', 'image')
  from public.demo_library l
  where l.kind = 'post_new' and exists (select 1 from public.v2_profiles x where x.id = (l.data->>'author_id')::uuid and x.is_demo)
  on conflict (id) do nothing;
  get diagnostics d = row_count;
  insert into public.comments (id, post_id, author_id, body, created_at)
  select l.key, (l.data->>'post_id')::uuid, (l.data->>'author_id')::uuid, l.data->>'body', (l.data->>'created_at')::timestamptz
  from public.demo_library l
  where l.kind = 'comment_new'
    and exists (select 1 from public.posts x where x.id = (l.data->>'post_id')::uuid)
    and exists (select 1 from public.v2_profiles x where x.id = (l.data->>'author_id')::uuid and x.is_demo)
  on conflict (id) do nothing;
  get diagnostics e = row_count;
  update public.posts p set media = l.data->'media'
  from public.demo_library l where l.kind = 'post_media' and l.key = p.id and p.is_demo and p.media is distinct from l.data->'media';
  get diagnostics f = row_count;
  update public.v2_profiles pr set posts_count = (select count(*) from public.posts x where x.author_id = pr.id) where pr.is_demo;
  update public.posts p set comment_count = (select count(*) from public.comments x where x.post_id = p.id) where p.is_demo;
  perform set_config('qola.internal', 'off', true);
  return jsonb_build_object('profiles', a, 'moved', b, 'dropped', c, 'new_posts', d, 'new_comments', e, 'images', f);
end $$;
revoke all on function public.demo_apply_library() from public, anon, authenticated;

create or replace function public.seed_demo_content()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare result jsonb;
begin
  if auth.uid() is not null and not public.v2_has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can seed demo content.';
  end if;
  result := public.seed_demo_content_base();
  return result || jsonb_build_object('deduplicated', public.dedupe_demo_posts(), 'creator_details', public.demo_fill_creator_details(), 'library', public.demo_apply_library());
end $$;