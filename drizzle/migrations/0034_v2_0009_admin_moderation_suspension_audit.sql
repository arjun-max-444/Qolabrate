alter table public.v2_profiles add column if not exists suspended_at timestamptz;
alter table public.v2_profiles add column if not exists suspension_reason text check (suspension_reason is null or char_length(suspension_reason) <= 500);

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
    new.suspended_at = old.suspended_at;
    new.suspension_reason = old.suspension_reason;
  end if;
  return new;
end; $$;

create or replace function public.is_suspended(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from public.v2_profiles where id = _uid), false)
$$;
grant execute on function public.is_suspended(uuid) to authenticated;

create or replace function public.is_verified(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select verified and suspended_at is null from public.v2_profiles where id = _uid), false)
$$;

create or replace function public.block_suspended()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  uid := auth.uid();
  if uid is not null and public.is_suspended(uid) then
    raise exception 'Your account is suspended. Contact the Qolabrate team if you think this is a mistake.';
  end if;
  return new;
end $$;
create trigger comments_block_suspended before insert on public.comments for each row execute function public.block_suspended();
create trigger messages_block_suspended before insert on public.messages for each row execute function public.block_suspended();
create trigger applications_block_suspended before insert or update on public.v2_applications for each row execute function public.block_suspended();
create trigger posts_block_suspended before insert or update on public.posts for each row execute function public.block_suspended();
create trigger campaigns_block_suspended before insert or update on public.v2_campaigns for each row execute function public.block_suspended();
create trigger follows_block_suspended before insert on public.follows for each row execute function public.block_suspended();

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.v2_profiles(id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target_type text not null check (char_length(target_type) <= 30),
  target_id uuid,
  reason text check (reason is null or char_length(reason) <= 1000),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
create policy "Staff read audit log" on public.admin_audit_log for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.audit(_action text, _type text, _target uuid, _reason text, _details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, reason, details)
  values (auth.uid(), _action, _type, _target, nullif(left(coalesce(_reason, ''), 1000), ''), coalesce(_details, '{}'::jsonb));
$$;
revoke execute on function public.audit(text, text, uuid, text, jsonb) from public, anon, authenticated;

alter table public.verification_requests add column if not exists reason text check (reason is null or char_length(reason) <= 500);
alter table public.verification_requests add column if not exists kind text not null default 'creator' check (kind in ('creator','brand'));
alter table public.verification_requests add column if not exists resubmissions integer not null default 0;
create index if not exists verification_requests_status_idx on public.verification_requests (status, created_at);

create or replace function public.verification_missing(_uid uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare p public.v2_profiles; missing text[] := '{}'; cp public.v2_creator_profiles; bp public.v2_brand_profiles;
begin
  select * into p from public.v2_profiles where id = _uid;
  if not found then return array['profile']; end if;
  if p.avatar_url is null or p.avatar_url = '' then missing := missing || 'profile photo'; end if;
  if coalesce(trim(p.bio), '') = '' then missing := missing || 'bio'; end if;
  if p.account_type = 'creator' then
    select * into cp from public.v2_creator_profiles where user_id = _uid;
    if cp.user_id is null or coalesce(array_length(cp.categories, 1), 0) = 0 then missing := missing || 'at least one niche'; end if;
    if (p.social_links is null or p.social_links = '{}'::jsonb) and coalesce(cp.portfolio_url, '') = '' then missing := missing || 'a social or portfolio link'; end if;
  else
    select * into bp from public.v2_brand_profiles where user_id = _uid;
    if bp.user_id is null or coalesce(trim(bp.company_description), '') = '' then missing := missing || 'company description'; end if;
    if coalesce(trim(p.website), '') = '' then missing := missing || 'company website'; end if;
  end if;
  return missing;
end $$;
revoke execute on function public.verification_missing(uuid) from public, anon;
grant execute on function public.verification_missing(uuid) to authenticated;

create or replace function public.verification_requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare missing text[];
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if tg_op = 'INSERT' or not (public.is_staff(auth.uid()) and auth.uid() <> old.user_id) then
    if public.is_suspended(new.user_id) then raise exception 'Suspended accounts can''t request verification.'; end if;
    if exists (select 1 from public.v2_profiles where id = new.user_id and verified) then raise exception 'Your account is already verified.'; end if;
    missing := public.verification_missing(new.user_id);
    if coalesce(array_length(missing, 1), 0) > 0 then
      raise exception 'Complete your profile first: %.', array_to_string(missing, ', ');
    end if;
    new.kind := (select account_type::text from public.v2_profiles where id = new.user_id);
    if tg_op = 'UPDATE' then
      new.user_id = old.user_id;
      new.resubmissions = old.resubmissions + case when old.status = 'rejected' then 1 else 0 end;
    else
      new.resubmissions = 0;
    end if;
    new.status = 'pending'; new.reviewed_at = null; new.reason = null; new.created_at = now();
    return new;
  end if;
  new.user_id = old.user_id; new.note = old.note; new.kind = old.kind; new.resubmissions = old.resubmissions; new.created_at = old.created_at;
  if new.status <> old.status then new.reviewed_at = now(); end if;
  if new.status = 'rejected' and coalesce(trim(new.reason), '') = '' then raise exception 'Give a reason when declining.'; end if;
  return new;
end $$;

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
    perform public.v2_notify(new.user_id, null, 'verification', 'Your verification request wasn''t approved: ' || coalesce(new.reason, 'see Settings') || ' You can update your profile and resubmit.', '/settings?section=account', 'verify:' || new.user_id || ':' || now());
  end if;
  return null;
end $$;

create or replace function public.admin_review_verification(_user uuid, _approve boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can review verification.'; end if;
  if not _approve and coalesce(trim(_reason), '') = '' then raise exception 'Give a reason when declining.'; end if;
  update public.verification_requests set status = case when _approve then 'approved' else 'rejected' end, reason = case when _approve then null else trim(_reason) end
    where user_id = _user and status = 'pending';
  if not found then raise exception 'There is no pending request for this account.'; end if;
  perform public.audit(case when _approve then 'verification_approved' else 'verification_rejected' end, 'profile', _user, _reason);
end $$;
revoke execute on function public.admin_review_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_verified(_user uuid, _verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can verify accounts.'; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles set verified = _verified where id = _user;
  update public.verification_requests set status = case when _verified then 'approved' else 'rejected' end,
    reason = case when _verified then null else 'Verification removed by the Qolabrate team.' end, reviewed_at = now()
    where user_id = _user and status = 'pending';
  perform set_config('qola.internal', 'off', true);
  perform public.audit(case when _verified then 'verified' else 'unverified' end, 'profile', _user, null);
end $$;

create or replace function public.admin_set_suspended(_user uuid, _suspend boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can suspend accounts.'; end if;
  if _user = auth.uid() then raise exception 'You can''t suspend your own account.'; end if;
  if _suspend and coalesce(trim(_reason), '') = '' then raise exception 'Give a reason for the suspension.'; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_profiles set suspended_at = case when _suspend then now() else null end,
    suspension_reason = case when _suspend then trim(_reason) else null end where id = _user;
  perform set_config('qola.internal', 'off', true);
  perform public.audit(case when _suspend then 'suspended' else 'unsuspended' end, 'profile', _user, _reason);
  perform public.v2_notify(_user, null, 'system',
    case when _suspend then 'Your account was suspended: ' || trim(_reason) else 'Your account suspension was lifted.' end,
    '/settings?section=account', 'suspend:' || _user || ':' || now());
end $$;
revoke execute on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

alter table public.v2_campaigns drop constraint if exists v2_campaigns_status_check;
alter table public.v2_campaigns add constraint campaigns_status_check check (status in ('draft','published','paused','closed','cancelled'));
alter table public.v2_campaigns add column if not exists moderation_note text check (moderation_note is null or char_length(moderation_note) <= 500);

create or replace function public.campaigns_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if new.status in ('draft','published','paused') then
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

create or replace function public.require_verified_publisher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') and not public.is_verified(new.brand_id) then
    raise exception 'Only verified brands can publish campaigns. Request verification in Settings.';
  end if;
  if tg_op = 'UPDATE' and old.moderation_note is not null and old.status = 'cancelled' then
    raise exception 'This campaign was removed by the Qolabrate team.';
  end if;
  new.moderation_note = case when tg_op = 'UPDATE' then old.moderation_note else null end;
  return new;
end $$;

create or replace function public.admin_moderate_campaign(_campaign uuid, _status text, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.v2_campaigns;
begin
  if not public.v2_has_role(auth.uid(), 'admin') then raise exception 'Only admins can moderate campaigns.'; end if;
  if _status not in ('paused','cancelled','published') then raise exception 'Unsupported action.'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Give a reason.'; end if;
  select * into c from public.v2_campaigns where id = _campaign;
  if not found then raise exception 'Campaign not found.'; end if;
  perform set_config('qola.internal', 'on', true);
  update public.v2_campaigns set status = _status,
    moderation_note = case when _status = 'published' then null else trim(_reason) end,
    stage = case when _status = 'cancelled' then 'completed' else 'open' end
    where id = _campaign;
  perform set_config('qola.internal', 'off', true);
  perform public.audit('campaign_' || _status, 'campaign', _campaign, _reason, jsonb_build_object('title', c.title, 'from', c.status));
  perform public.v2_notify(c.brand_id, null, 'system',
    case _status when 'paused' then 'Your campaign "' || c.title || '" was paused by the Qolabrate team: ' || trim(_reason)
                 when 'cancelled' then 'Your campaign "' || c.title || '" was removed by the Qolabrate team: ' || trim(_reason)
                 else 'Your campaign "' || c.title || '" was restored.' end,
    '/collaborate/c/' || c.id, 'moderate:' || c.id || ':' || now());
end $$;
revoke execute on function public.admin_moderate_campaign(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_campaign(uuid, text, text) to authenticated;

create or replace function public.reports_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status then
    perform public.audit('report_' || new.status, 'report', new.id, null, jsonb_build_object('target_type', new.target_type, 'target_id', new.target_id, 'reason', new.reason));
  end if;
  return null;
end $$;
create trigger reports_audit after update on public.reports for each row execute function public.reports_audit();

create or replace function public.admin_platform_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only.'; end if;
  return jsonb_build_object(
    'members', (select count(*) from public.v2_profiles where not is_demo),
    'creators', (select count(*) from public.v2_profiles where not is_demo and account_type = 'creator'),
    'brands', (select count(*) from public.v2_profiles where not is_demo and account_type = 'brand'),
    'verified', (select count(*) from public.v2_profiles where not is_demo and verified),
    'suspended', (select count(*) from public.v2_profiles where suspended_at is not null),
    'pending_verification', (select count(*) from public.verification_requests where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'posts_7d', (select count(*) from public.posts where not is_demo and created_at > now() - interval '7 days'),
    'campaigns_live', (select count(*) from public.v2_campaigns where not is_demo and status = 'published'),
    'applications_7d', (select count(*) from public.v2_applications where created_at > now() - interval '7 days'),
    'collaborations_active', (select count(*) from public.collaborations where status not in ('completed','cancelled')),
    'new_members_7d', (select count(*) from public.v2_profiles where not is_demo and created_at > now() - interval '7 days')
  );
end $$;
revoke execute on function public.admin_platform_stats() from public, anon;
grant execute on function public.admin_platform_stats() to authenticated;