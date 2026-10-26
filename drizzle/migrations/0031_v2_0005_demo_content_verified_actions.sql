alter table public.v2_profiles
  add column if not exists is_demo boolean not null default false,
  add column if not exists engagement_rate numeric(5,2) check (engagement_rate is null or (engagement_rate >= 0 and engagement_rate <= 100));

alter table public.v2_campaigns
  add column if not exists is_demo boolean not null default false,
  add column if not exists target_audience text check (target_audience is null or char_length(target_audience) <= 300),
  add column if not exists eligibility text[] not null default '{}',
  add column if not exists stage text not null default 'open' check (stage in ('open','in_progress','completed'));

alter table public.posts
  add column if not exists is_demo boolean not null default false,
  add column if not exists category text check (category is null or char_length(category) <= 40),
  add column if not exists post_type text not null default 'post' check (post_type in ('post','image','video','portfolio','promotion','sponsored','collab')),
  add column if not exists campaign_id uuid references public.v2_campaigns(id) on delete set null,
  add column if not exists engagement_score integer generated always as (like_count + comment_count * 3 + repost_count * 2) stored;

create index if not exists posts_category_idx on public.posts (category, created_at desc);
create index if not exists posts_engagement_idx on public.posts (engagement_score desc);
create index if not exists posts_demo_idx on public.posts (is_demo);
create index if not exists posts_campaign_idx on public.posts (campaign_id);
create index if not exists campaigns_stage_idx on public.v2_campaigns (stage, category);
create index if not exists campaigns_demo_idx on public.v2_campaigns (is_demo);
create index if not exists profiles_demo_idx on public.v2_profiles (is_demo);

comment on column public.v2_profiles.is_demo is 'Demo content created by seed_demo_content(); not a real member.';
comment on column public.posts.is_demo is 'Demo content created by seed_demo_content().';
comment on column public.v2_campaigns.is_demo is 'Demo content created by seed_demo_content().';

alter table public.v2_profiles drop constraint if exists v2_profiles_id_fkey;

create or replace function public.guard_demo_flag()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    if tg_op = 'INSERT' then new.is_demo = false; else new.is_demo = old.is_demo; end if;
  end if;
  return new;
end $$;
create trigger posts_demo_guard before insert or update on public.posts for each row execute function public.guard_demo_flag();
create trigger campaigns_demo_guard before insert or update on public.v2_campaigns for each row execute function public.guard_demo_flag();

create or replace function public.profiles_insert_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    new.is_demo = false;
    new.engagement_rate = null;
    new.verified = false;
  end if;
  if not new.is_demo and not exists (select 1 from auth.users where id = new.id) then
    raise exception 'Profiles must belong to a signed-in account.';
  end if;
  return new;
end $$;
create trigger profiles_insert_guard before insert on public.v2_profiles for each row execute function public.profiles_insert_guard();

create or replace function public.protect_profile_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    new.verified = old.verified;
    new.followers_count = old.followers_count;
    new.following_count = old.following_count;
    new.posts_count = old.posts_count;
    new.is_demo = old.is_demo;
    new.engagement_rate = old.engagement_rate;
  end if;
  return new;
end; $$;

create or replace function public.cleanup_orphan_profiles()
returns void language sql security definer set search_path = public as $$
  delete from public.v2_profiles p where not p.is_demo and not exists (select 1 from auth.users u where u.id = p.id);
$$;
revoke execute on function public.cleanup_orphan_profiles() from public, anon, authenticated;
select cron.schedule('qolabrate-orphan-profiles', '17 * * * *', 'select public.cleanup_orphan_profiles()');

create or replace function public.bump_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d integer;
  r record;
  prev text := coalesce(current_setting('qola.internal', true), 'off');
begin
  if tg_op = 'INSERT' then d := 1; r := new; else d := -1; r := old; end if;
  perform set_config('qola.internal', 'on', true);
  if tg_table_name = 'likes' then
    update public.posts set like_count = greatest(like_count + d, 0) where id = r.post_id;
  elsif tg_table_name = 'reposts' then
    update public.posts set repost_count = greatest(repost_count + d, 0) where id = r.post_id;
  elsif tg_table_name = 'comments' then
    update public.posts set comment_count = greatest(comment_count + d, 0) where id = r.post_id;
  elsif tg_table_name = 'posts' then
    update public.v2_profiles set posts_count = greatest(posts_count + d, 0) where id = r.author_id;
  elsif tg_table_name = 'follows' then
    update public.v2_profiles set followers_count = greatest(followers_count + d, 0) where id = r.following_id;
    update public.v2_profiles set following_count = greatest(following_count + d, 0) where id = r.follower_id;
  end if;
  perform set_config('qola.internal', prev, true);
  return null;
end; $$;

create or replace function public.is_verified(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select verified from public.v2_profiles where id = _uid), false)
$$;
grant execute on function public.is_verified(uuid) to authenticated;

drop policy if exists "Create own posts" on public.posts;
create policy "Verified members create posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_verified(auth.uid()));

create or replace function public.require_verified_publisher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') and not public.is_verified(new.brand_id) then
    raise exception 'Only verified brands can publish campaigns. Request verification in Settings.';
  end if;
  return new;
end $$;
create trigger campaigns_verified before insert or update on public.v2_campaigns for each row execute function public.require_verified_publisher();

create or replace function public.campaigns_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if new.status in ('draft','published') then
    new.stage = 'open';
  elsif new.status = 'closed' then
    if tg_op = 'INSERT' or old.status <> 'closed' then
      new.stage = case when exists (select 1 from public.collaborations where campaign_id = new.id) then 'in_progress' else 'completed' end;
    elsif new.stage = 'open' then
      new.stage = old.stage;
    end if;
  end if;
  return new;
end $$;
create trigger campaigns_stage before insert or update on public.v2_campaigns for each row execute function public.campaigns_stage();

create or replace function public.require_verified_applicant()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  select is_demo, brand_id into c from public.v2_campaigns where id = new.campaign_id;
  if c.is_demo then raise exception 'This is a demo campaign and doesn''t accept applications.'; end if;
  if new.status = 'invited' then
    if not public.is_verified(c.brand_id) then raise exception 'Only verified brands can invite creators. Request verification in Settings.'; end if;
  elsif not public.is_verified(new.creator_id) then
    raise exception 'Only verified creators can apply to campaigns. Request verification in Settings.';
  end if;
  return new;
end $$;
create trigger applications_verified before insert on public.v2_applications for each row execute function public.require_verified_applicant();

create or replace function public.posts_link_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if new.campaign_id is not null and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id) then
    if not (public.is_campaign_owner(new.campaign_id, new.author_id) or exists (
      select 1 from public.collaborations co join public.collaboration_members m on m.collaboration_id = co.id
      where co.campaign_id = new.campaign_id and m.user_id = new.author_id)) then
      raise exception 'You can only link campaigns you run or work on.';
    end if;
  end if;
  return new;
end $$;
create trigger posts_link_guard before insert or update on public.posts for each row execute function public.posts_link_guard();

create or replace function public.v2_notify(_user uuid, _actor uuid, _type text, _body text, _link text, _key text)
returns void language plpgsql security definer set search_path = public as $$
declare cat text; p public.notification_preferences;
begin
  if _user is null or _user = _actor then return; end if;
  if exists (select 1 from public.v2_profiles where id = _user and is_demo) then return; end if;
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

create or replace function public.start_conversation(_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid; perm text; demo boolean;
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
  select dm_permission, is_demo into perm, demo from public.v2_profiles where id = _other;
  if not found then raise exception 'Account not found.'; end if;
  if demo then raise exception 'This is a demo profile and can''t receive messages.'; end if;
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

create table public.verification_requests (
  user_id uuid primary key references public.v2_profiles(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert, update, delete on public.verification_requests to authenticated;
grant all on public.verification_requests to service_role;
alter table public.verification_requests enable row level security;
create policy "Read own or staff" on public.verification_requests for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Request as self" on public.verification_requests for insert to authenticated with check (user_id = auth.uid());
create policy "Update own or staff" on public.verification_requests for update to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid())) with check (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Withdraw own" on public.verification_requests for delete to authenticated using (user_id = auth.uid());

create or replace function public.verification_requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if public.is_verified(new.user_id) then raise exception 'Your account is already verified.'; end if;
    new.status = 'pending'; new.reviewed_at = null; new.created_at = now();
    return new;
  end if;
  new.user_id = old.user_id;
  if public.is_staff(auth.uid()) and auth.uid() <> old.user_id then
    new.note = old.note;
    if new.status <> old.status then new.reviewed_at = now(); end if;
  else
    new.status = 'pending'; new.reviewed_at = null; new.created_at = now();
  end if;
  return new;
end $$;
create trigger verification_requests_guard before insert or update on public.verification_requests for each row execute function public.verification_requests_guard();

create or replace function public.verification_requests_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return null; end if;
  if new.status = 'approved' then
    perform set_config('qola.internal', 'on', true);
    update public.v2_profiles set verified = true where id = new.user_id;
    perform set_config('qola.internal', 'off', true);
    perform public.v2_notify(new.user_id, null, 'verification', 'Your account is verified. You can now post, publish campaigns and apply.', '/settings?section=account', 'verify:' || new.user_id || ':' || now());
  elsif new.status = 'rejected' then
    perform public.v2_notify(new.user_id, null, 'verification', 'Your verification request wasn''t approved yet. Complete your profile and try again.', '/settings?section=account', 'verify:' || new.user_id || ':' || now());
  end if;
  return null;
end $$;
create trigger verification_requests_after after update on public.verification_requests for each row execute function public.verification_requests_after();

create or replace function public.admin_set_verified(_user uuid, _verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can verify accounts.'; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles set verified = _verified where id = _user;
  update public.verification_requests set status = case when _verified then 'approved' else 'rejected' end, reviewed_at = now()
    where user_id = _user and status = 'pending';
  perform set_config('qola.internal', 'off', true);
end $$;
revoke execute on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

create or replace function public.trending_post_ids(_category text default null, _offset int default 0, _limit int default 15)
returns setof uuid language sql stable set search_path = public as $$
  select p.id from public.posts p
  where p.visibility = 'public' and (_category is null or p.category = _category)
  order by (p.engagement_score + 1) / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.2) desc, p.created_at desc
  limit least(greatest(_limit, 1), 50) offset greatest(_offset, 0)
$$;
revoke execute on function public.trending_post_ids(text, int, int) from public, anon;
grant execute on function public.trending_post_ids(text, int, int) to authenticated;

create or replace function public.public_feed(_category text default null, _q text default null, _sort text default 'latest', _offset int default 0, _limit int default 15)
returns table (
  id uuid, body text, media jsonb, category text, post_type text, is_demo boolean,
  like_count int, comment_count int, repost_count int, created_at timestamptz, campaign_id uuid, author jsonb
) language sql stable security definer set search_path = public as $$
  select p.id, p.body, p.media, p.category, p.post_type, p.is_demo, p.like_count, p.comment_count, p.repost_count, p.created_at, p.campaign_id,
    jsonb_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url,
      'verified', a.verified, 'account_type', a.account_type, 'is_demo', a.is_demo)
  from public.posts p join public.v2_profiles a on a.id = p.author_id
  where p.visibility = 'public' and a.onboarded
    and (_category is null or p.category = _category)
    and (_q is null or btrim(_q) = '' or p.body ilike '%' || left(btrim(_q), 80) || '%')
  order by
    case when _sort = 'trending' then (p.engagement_score + 1) / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.2) end desc nulls last,
    p.created_at desc
  limit least(greatest(_limit, 1), 30) offset greatest(_offset, 0)
$$;
revoke execute on function public.public_feed(text, text, text, int, int) from public;
grant execute on function public.public_feed(text, text, text, int, int) to anon, authenticated;

create or replace function public.public_campaigns(_category text default null, _stage text default null, _q text default null, _min_budget int default null, _offset int default 0, _limit int default 15)
returns table (
  id uuid, title text, description text, category text, deliverables text[], target_audience text, eligibility text[],
  compensation_type text, budget_min int, budget_max int, currency text, application_deadline date, deadline date,
  applications_count int, creators_needed int, stage text, status text, is_demo boolean, published_at timestamptz, brand jsonb
) language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.description, c.category, c.deliverables, c.target_audience, c.eligibility,
    c.compensation_type, c.budget_min, c.budget_max, c.currency, c.application_deadline, c.deadline,
    c.applications_count, c.creators_needed, c.stage, c.status, c.is_demo, c.published_at,
    jsonb_build_object('id', b.id, 'username', b.username, 'display_name', b.display_name, 'avatar_url', b.avatar_url,
      'verified', b.verified, 'account_type', b.account_type, 'is_demo', b.is_demo)
  from public.v2_campaigns c join public.v2_profiles b on b.id = c.brand_id
  where c.status in ('published','closed')
    and (_category is null or c.category = _category)
    and (_stage is null or c.stage = _stage)
    and (_min_budget is null or coalesce(c.budget_max, c.budget_min, 0) >= _min_budget)
    and (_q is null or btrim(_q) = '' or c.title ilike '%' || left(btrim(_q), 80) || '%' or c.description ilike '%' || left(btrim(_q), 80) || '%')
  order by case c.stage when 'open' then 0 when 'in_progress' then 1 else 2 end, c.published_at desc nulls last
  limit least(greatest(_limit, 1), 30) offset greatest(_offset, 0)
$$;
revoke execute on function public.public_campaigns(text, text, text, int, int, int) from public;
grant execute on function public.public_campaigns(text, text, text, int, int, int) to anon, authenticated;