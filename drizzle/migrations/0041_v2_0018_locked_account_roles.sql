alter table public.v2_profiles add column if not exists role_locked_at timestamptz;
update public.v2_profiles set role_locked_at = coalesce(created_at, now()) where role_locked_at is null and (onboarded or is_demo);

create or replace function public.is_brand(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.v2_profiles where id = _uid and account_type = 'brand' and role_locked_at is not null)
$$;
create or replace function public.is_creator(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.v2_profiles where id = _uid and account_type = 'creator' and role_locked_at is not null)
$$;

create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  kind text not null check (kind in ('role_chosen','role_changed','blocked')),
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists account_events_user_idx on public.account_events (user_id, created_at desc);
create index if not exists account_events_recent_idx on public.account_events (created_at desc);
grant select on public.account_events to authenticated;
grant all on public.account_events to service_role;
alter table public.account_events enable row level security;
create policy "Own or staff read account events" on public.account_events for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.account_event(_user uuid, _kind text, _detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.account_events (user_id, kind, detail) values (_user, _kind, left(coalesce(_detail, ''), 300));
$$;
revoke all on function public.account_event(uuid, text, text) from public, anon, authenticated;

create or replace function public.report_blocked_action(_action text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.v2_profiles where id = me) then return; end if;
  if (select count(*) from public.account_events where user_id = me and kind = 'blocked' and created_at > now() - interval '1 hour') >= 20 then return; end if;
  perform public.account_event(me, 'blocked', _action);
end $$;
revoke all on function public.report_blocked_action(text) from public, anon;
grant execute on function public.report_blocked_action(text) to authenticated;

create or replace function public.account_type_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' or new.is_demo then return new; end if;
  if tg_op = 'INSERT' then
    new.role_locked_at := null;
    return new;
  end if;
  if new.account_type is distinct from old.account_type then
    raise exception 'Your account type is locked. Creator and brand accounts can''t be switched; use a different email for the other type.';
  end if;
  new.role_locked_at := old.role_locked_at;
  if new.onboarded and new.role_locked_at is null then
    raise exception 'Choose Creator or Brand before finishing your profile.';
  end if;
  return new;
end $$;

create or replace function public.choose_account_type(_type public.account_type) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.v2_profiles;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select * into p from public.v2_profiles where id = me;
  if not found then raise exception 'Profile not found.'; end if;
  if p.role_locked_at is not null then
    if p.account_type = _type then return; end if;
    perform public.account_event(me, 'blocked', 'Tried to switch account type to ' || _type);
    raise exception 'Your account type is locked as %. Use a different email for a % account.', p.account_type, _type;
  end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles set account_type = _type, role_locked_at = now() where id = me;
  perform set_config('qola.internal', 'off', true);
  perform public.account_event(me, 'role_chosen', 'Chose ' || _type || ' account');
end $$;
revoke all on function public.choose_account_type(public.account_type) from public, anon;
grant execute on function public.choose_account_type(public.account_type) to authenticated;

create or replace function public.admin_change_account_type(_user uuid, _type public.account_type, _reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.v2_profiles;
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can change account types.'; end if;
  if _user = auth.uid() then raise exception 'You can''t change your own account type.'; end if;
  if length(coalesce(trim(_reason), '')) < 10 then raise exception 'Give a reason of at least 10 characters for this review.'; end if;
  select * into p from public.v2_profiles where id = _user;
  if not found or p.is_demo then raise exception 'Account not found.'; end if;
  if p.account_type = _type then raise exception 'This account is already a % account.', _type; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles set account_type = _type, role_locked_at = now() where id = _user;
  perform set_config('qola.internal', 'off', true);
  perform public.audit('account_type_changed', 'profile', _user, _reason, jsonb_build_object('from', p.account_type, 'to', _type));
  perform public.account_event(_user, 'role_changed', 'Changed from ' || p.account_type || ' to ' || _type || ' by admin review: ' || trim(_reason));
  perform public.v2_notify(_user, null, 'system', 'After an account review your account is now a ' || _type || ' account.', '/settings', 'role:' || _user || ':' || now());
end $$;
revoke all on function public.admin_change_account_type(uuid, public.account_type, text) from public, anon;
grant execute on function public.admin_change_account_type(uuid, public.account_type, text) to authenticated;

create or replace function public.posts_creator_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if not public.is_creator(new.author_id) then
    perform public.account_event(new.author_id, 'blocked', 'Tried to post in the feed');
    raise exception 'Only creator accounts can post in the feed. Brands share through campaigns.';
  end if;
  return new;
end $$;
drop trigger if exists posts_author_role on public.posts;
create trigger posts_author_role before insert on public.posts for each row execute function public.posts_creator_only();

drop policy if exists "Verified members create posts" on public.posts;
create policy "Verified creators create posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_verified(auth.uid()) and public.is_creator(auth.uid()));

drop policy if exists "Brands create own campaigns" on public.ai_campaigns;
create policy "Brands create own campaigns" on public.ai_campaigns for insert to authenticated
  with check (brand_id = auth.uid() and public.is_brand(auth.uid()));
drop policy if exists "Brands create own orders" on public.v2_ai_orders;
create policy "Brands create own orders" on public.v2_ai_orders for insert to authenticated
  with check (brand_id = auth.uid() and public.is_brand(auth.uid()));
drop policy if exists "Owner creates shortlists" on public.v2_shortlists;
create policy "Owner creates shortlists" on public.v2_shortlists for insert to authenticated
  with check (owner_id = auth.uid() and public.is_brand(auth.uid()));
drop policy if exists "Brands create campaigns" on public.v2_campaigns;
create policy "Brands create campaigns" on public.v2_campaigns for insert to authenticated
  with check (brand_id = auth.uid() and public.is_brand(auth.uid()));
drop policy if exists "Own brand profile insert" on public.v2_brand_profiles;
create policy "Own brand profile insert" on public.v2_brand_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.is_brand(auth.uid()));
drop policy if exists "Own brand profile update" on public.v2_brand_profiles;
create policy "Own brand profile update" on public.v2_brand_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_brand(auth.uid()));
drop policy if exists "Own creator profile insert" on public.v2_creator_profiles;
create policy "Own creator profile insert" on public.v2_creator_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.is_creator(auth.uid()));
drop policy if exists "Own creator profile update" on public.v2_creator_profiles;
create policy "Own creator profile update" on public.v2_creator_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_creator(auth.uid()));

drop trigger if exists applications_closed on public.v2_applications;
drop policy if exists "Apply or invite" on public.v2_applications;
create policy "Apply or invite" on public.v2_applications for insert to authenticated
  with check (((creator_id = auth.uid()) and status = 'submitted' and public.is_creator(auth.uid()))
    or (public.is_campaign_owner(campaign_id, auth.uid()) and status = 'invited' and public.is_creator(creator_id)));

create or replace function public.trending_post_ids(_category text default null, _offset integer default 0, _limit integer default 15)
returns setof uuid language sql stable set search_path = public as $$
  select p.id from public.posts p join public.v2_profiles a on a.id = p.author_id
  where p.visibility = 'public' and a.account_type = 'creator' and (_category is null or p.category = _category)
  order by (p.engagement_score + 1) / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.2) desc, p.created_at desc
  limit least(greatest(_limit, 1), 50) offset greatest(_offset, 0)
$$;

create or replace function public.public_feed(_category text default null, _q text default null, _sort text default 'latest', _offset integer default 0, _limit integer default 15)
returns table(id uuid, body text, media jsonb, category text, post_type text, is_demo boolean, like_count integer, comment_count integer, repost_count integer, created_at timestamptz, campaign_id uuid, author jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.body, p.media, p.category, p.post_type, p.is_demo, p.like_count, p.comment_count, p.repost_count, p.created_at, p.campaign_id,
    jsonb_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url,
      'verified', a.verified, 'account_type', a.account_type, 'is_demo', a.is_demo)
  from public.posts p join public.v2_profiles a on a.id = p.author_id
  where p.visibility = 'public' and a.onboarded and a.account_type = 'creator'
    and (_category is null or p.category = _category)
    and (_q is null or btrim(_q) = '' or p.body ilike '%' || left(btrim(_q), 80) || '%')
  order by
    case when _sort = 'trending' then (p.engagement_score + 1) / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.2) end desc nulls last,
    p.created_at desc
  limit least(greatest(_limit, 1), 30) offset greatest(_offset, 0)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.v2_profiles (id, display_name, avatar_url, account_type)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), ''), 60),
    new.raw_user_meta_data->>'avatar_url',
    case when coalesce(new.raw_user_meta_data->>'account_type', new.raw_user_meta_data->>'signup_role') = 'brand' then 'brand'::public.account_type else 'creator'::public.account_type end
  )
  on conflict (id) do nothing;
  insert into public.v2_user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;