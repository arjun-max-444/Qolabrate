-- Keep the new app's account type in step with the Creator/Brand choice made on the existing sign-in page.
create or replace function public.v2_sync_role_from_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare em text; nm text;
begin
  if new.role not in ('creator','brand') then return new; end if;
  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1)) into em, nm
    from auth.users where id = new.user_id;
  perform set_config('qola.internal', 'on', true);
  insert into public.v2_profiles (id, display_name, account_type, role_locked_at)
  values (new.user_id, left(coalesce(nm, ''), 60), new.role::text::public.account_type, now())
  on conflict (id) do update set account_type = excluded.account_type,
    role_locked_at = coalesce(public.v2_profiles.role_locked_at, now())
    where public.v2_profiles.role_locked_at is null;
  insert into public.v2_user_roles (user_id, role) values (new.user_id, 'user') on conflict do nothing;
  perform set_config('qola.internal', 'off', true);
  return new;
end $$;
revoke all on function public.v2_sync_role_from_signup() from public, anon, authenticated;
drop trigger if exists v2_sync_role_from_signup on public.user_roles;
create trigger v2_sync_role_from_signup after insert on public.user_roles
  for each row execute function public.v2_sync_role_from_signup();

create or replace function public.v2_sync_admin_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin' and exists (select 1 from public.v2_profiles where id = new.user_id) then
    insert into public.v2_user_roles (user_id, role) values (new.user_id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.v2_sync_admin_role() from public, anon, authenticated;
drop trigger if exists v2_sync_admin_role on public.user_roles;
create trigger v2_sync_admin_role after insert on public.user_roles
  for each row execute function public.v2_sync_admin_role();

-- Existing members carry over with their locked account type and admin access.
select set_config('qola.internal', 'on', true);
insert into public.v2_profiles (id, display_name, account_type, role_locked_at)
select p.id, left(coalesce(nullif(p.full_name,''), split_part(p.email,'@',1), ''), 60),
  case when exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'brand') then 'brand'::public.account_type else 'creator'::public.account_type end,
  case when exists (select 1 from public.user_roles r where r.user_id = p.id and r.role in ('brand','creator')) then now() end
from public.profiles p
on conflict (id) do nothing;
update public.v2_profiles v set
  account_type = case when exists (select 1 from public.user_roles r where r.user_id = v.id and r.role = 'brand') then 'brand'::public.account_type else 'creator'::public.account_type end,
  role_locked_at = now()
where not v.is_demo and v.role_locked_at is null
  and exists (select 1 from public.user_roles r where r.user_id = v.id and r.role in ('brand','creator'));
insert into public.v2_user_roles (user_id, role) select id, 'user' from public.v2_profiles where not is_demo on conflict do nothing;
insert into public.v2_user_roles (user_id, role) select user_id, 'admin' from public.user_roles where role = 'admin' and user_id in (select id from public.v2_profiles) on conflict do nothing;
insert into public.v2_user_roles (user_id, role)
select u.id, 'admin' from auth.users u join public.v2_profiles v on v.id = u.id where lower(u.email) = 'arjunbablu333@gmail.com'
on conflict do nothing;
select set_config('qola.internal', 'off', true);

-- Demo content from the uploaded site (repeatable, marked is_demo).
select public.seed_demo_content();