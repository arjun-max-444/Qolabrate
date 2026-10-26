create table public.v2_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null default 'Other' check (char_length(category) <= 60),
  skills text[] not null default '{}',
  deliverables text[] not null default '{}',
  compensation_type text not null default 'negotiable' check (compensation_type in ('paid','unpaid','negotiable')),
  budget_min integer check (budget_min is null or budget_min >= 0),
  budget_max integer check (budget_max is null or budget_max >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  project_type text not null default 'one_off' check (project_type in ('one_off','ongoing','ambassador','event')),
  deadline date,
  application_deadline date,
  creators_needed integer not null default 1 check (creators_needed between 1 and 1000),
  remote boolean not null default true,
  location text check (location is null or char_length(location) <= 100),
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  applications_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_status_idx on public.v2_campaigns (status, created_at desc);
create index campaigns_brand_idx on public.v2_campaigns (brand_id, created_at desc);
grant select, insert, update, delete on public.v2_campaigns to authenticated;
grant all on public.v2_campaigns to service_role;
alter table public.v2_campaigns enable row level security;
create policy "Campaigns visible" on public.v2_campaigns for select to authenticated
  using (status <> 'draft' or brand_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Brands create campaigns" on public.v2_campaigns for insert to authenticated
  with check (brand_id = auth.uid() and exists (select 1 from public.v2_profiles where id = auth.uid() and account_type = 'brand'));
create policy "Brands edit own campaigns" on public.v2_campaigns for update to authenticated
  using (brand_id = auth.uid()) with check (brand_id = auth.uid());
create policy "Brands delete own drafts" on public.v2_campaigns for delete to authenticated
  using (brand_id = auth.uid() and status = 'draft');

create or replace function public.campaigns_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    if tg_op = 'UPDATE' then
      new.applications_count = old.applications_count;
      new.brand_id = old.brand_id;
      new.created_at = old.created_at;
    else
      new.applications_count = 0;
    end if;
  end if;
  if new.budget_min is not null and new.budget_max is not null and new.budget_max < new.budget_min then
    raise exception 'The maximum budget must be at least the minimum.';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at = coalesce(new.published_at, now());
  end if;
  if tg_op = 'UPDATE' and old.status in ('closed','cancelled') and new.status = 'draft' then
    raise exception 'A closed campaign can''t go back to draft.';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger campaigns_guard before insert or update on public.v2_campaigns for each row execute function public.campaigns_guard();

create or replace function public.is_campaign_owner(_campaign uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.v2_campaigns where id = _campaign and brand_id = _uid)
$$;

create table public.campaign_saves (
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  campaign_id uuid not null references public.v2_campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, campaign_id)
);
grant select, insert, delete on public.campaign_saves to authenticated;
grant all on public.campaign_saves to service_role;
alter table public.campaign_saves enable row level security;
create policy "Own saves read" on public.campaign_saves for select to authenticated using (user_id = auth.uid());
create policy "Save as self" on public.campaign_saves for insert to authenticated with check (user_id = auth.uid());
create policy "Unsave as self" on public.campaign_saves for delete to authenticated using (user_id = auth.uid());

create table public.v2_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.v2_campaigns(id) on delete cascade,
  creator_id uuid not null references public.v2_profiles(id) on delete cascade,
  proposal text not null default '' check (char_length(proposal) <= 3000),
  rate text check (rate is null or char_length(rate) <= 60),
  portfolio_item_ids uuid[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','invited','shortlisted','accepted','rejected','withdrawn','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index applications_creator_idx on public.v2_applications (creator_id, created_at desc);
create index applications_campaign_idx on public.v2_applications (campaign_id, created_at desc);
grant select, insert, update on public.v2_applications to authenticated;
grant all on public.v2_applications to service_role;
alter table public.v2_applications enable row level security;
create policy "Applicant or brand reads" on public.v2_applications for select to authenticated
  using (creator_id = auth.uid() or public.is_campaign_owner(campaign_id, auth.uid()));
create policy "Apply or invite" on public.v2_applications for insert to authenticated
  with check (
    (creator_id = auth.uid() and status = 'submitted')
    or (public.is_campaign_owner(campaign_id, auth.uid()) and status = 'invited')
  );
create policy "Applicant or brand updates" on public.v2_applications for update to authenticated
  using (creator_id = auth.uid() or public.is_campaign_owner(campaign_id, auth.uid()))
  with check (creator_id = auth.uid() or public.is_campaign_owner(campaign_id, auth.uid()));

create or replace function public.applications_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.v2_campaigns; me uuid := auth.uid(); target public.v2_profiles; owner boolean;
begin
  select * into c from public.v2_campaigns where id = coalesce(new.campaign_id, old.campaign_id);
  owner := (c.brand_id = me);
  if tg_op = 'INSERT' then
    select * into target from public.v2_profiles where id = new.creator_id;
    if target.account_type <> 'creator' then raise exception 'Only creator accounts can join campaigns.'; end if;
    if c.status <> 'published' then raise exception 'This campaign isn''t accepting applications.'; end if;
    if public.is_blocked_between(c.brand_id, new.creator_id) then raise exception 'You can''t interact with this account.'; end if;
    if new.status = 'submitted' then
      if c.application_deadline is not null and c.application_deadline < current_date then
        raise exception 'The application deadline has passed.';
      end if;
      perform public.rate_limit('v2_applications', 'creator_id', new.creator_id, 20, interval '1 hour');
    elsif new.status = 'invited' then
      if target.collab_permission = 'nobody' then raise exception 'This creator isn''t accepting collaboration requests.'; end if;
      if target.collab_permission = 'following' and not exists (select 1 from public.follows where follower_id = new.creator_id and following_id = c.brand_id) then
        raise exception 'This creator only accepts requests from accounts they follow.';
      end if;
      new.proposal = '';
    end if;
    new.created_at = now(); new.updated_at = now();
    return new;
  end if;

  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  new.campaign_id = old.campaign_id; new.creator_id = old.creator_id; new.created_at = old.created_at;
  if new.status <> old.status then
    if me = old.creator_id and not (
      (old.status in ('submitted','shortlisted') and new.status = 'withdrawn')
      or (old.status = 'invited' and new.status in ('accepted','declined'))
    ) then raise exception 'This status change isn''t allowed.';
    elsif owner and me <> old.creator_id and not (
      old.status in ('submitted','shortlisted') and new.status in ('shortlisted','accepted','rejected')
    ) then raise exception 'This status change isn''t allowed.';
    end if;
  end if;
  if me <> old.creator_id or old.status <> 'submitted' then
    new.proposal = old.proposal; new.rate = old.rate; new.portfolio_item_ids = old.portfolio_item_ids;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger applications_guard before insert or update on public.v2_applications for each row execute function public.applications_guard();

create table public.collaborations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid unique references public.v2_campaigns(id) on delete set null,
  title text not null,
  brand_id uuid not null references public.v2_profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted','in_progress','submitted','revision_requested','completed','cancelled','disputed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.collaboration_members (
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  user_id uuid not null references public.v2_profiles(id) on delete cascade,
  role text not null check (role in ('brand','creator')),
  joined_at timestamptz not null default now(),
  primary key (collaboration_id, user_id)
);
create index collaboration_members_user_idx on public.collaboration_members (user_id);

create or replace function public.is_collab_member(_collab uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.collaboration_members where collaboration_id = _collab and user_id = _uid)
$$;
create or replace function public.collab_role(_collab uuid, _uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.collaboration_members where collaboration_id = _collab and user_id = _uid
$$;

grant select, update on public.collaborations to authenticated;
grant all on public.collaborations to service_role;
alter table public.collaborations enable row level security;
create policy "Members read collaboration" on public.collaborations for select to authenticated using (public.is_collab_member(id, auth.uid()));
create policy "Members update collaboration" on public.collaborations for update to authenticated using (public.is_collab_member(id, auth.uid())) with check (public.is_collab_member(id, auth.uid()));

grant select on public.collaboration_members to authenticated;
grant all on public.collaboration_members to service_role;
alter table public.collaboration_members enable row level security;
create policy "Members see members" on public.collaboration_members for select to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));

create table public.collaboration_activity (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  actor_id uuid references public.v2_profiles(id) on delete set null,
  kind text not null default 'comment' check (kind in ('comment','status','milestone','task','deliverable','file','member')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index collab_activity_idx on public.collaboration_activity (collaboration_id, created_at desc);
grant select, insert on public.collaboration_activity to authenticated;
grant all on public.collaboration_activity to service_role;
alter table public.collaboration_activity enable row level security;
create policy "Members read activity" on public.collaboration_activity for select to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members comment" on public.collaboration_activity for insert to authenticated
  with check (actor_id = auth.uid() and kind = 'comment' and public.is_collab_member(collaboration_id, auth.uid()));

create or replace function public.log_collab(_collab uuid, _kind text, _body text)
returns void language sql security definer set search_path = public as $$
  insert into public.collaboration_activity (collaboration_id, actor_id, kind, body) values (_collab, auth.uid(), _kind, left(_body, 2000));
$$;
revoke execute on function public.log_collab(uuid, text, text) from public, anon, authenticated;

create or replace function public.collaborations_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare role text := public.collab_role(old.id, auth.uid()); ok boolean := false;
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  new.campaign_id = old.campaign_id; new.brand_id = old.brand_id; new.title = old.title; new.created_at = old.created_at;
  if new.status <> old.status then
    if old.status in ('completed','cancelled') then raise exception 'This collaboration is closed.'; end if;
    if role = 'brand' then
      ok := (old.status = 'accepted' and new.status in ('in_progress','cancelled'))
        or (old.status = 'in_progress' and new.status in ('cancelled','disputed','submitted'))
        or (old.status = 'submitted' and new.status in ('completed','revision_requested','disputed'))
        or (old.status = 'revision_requested' and new.status in ('in_progress','cancelled','disputed'))
        or (old.status = 'disputed' and new.status in ('in_progress','completed','cancelled'));
    elsif role = 'creator' then
      ok := (old.status = 'accepted' and new.status = 'in_progress')
        or (old.status = 'in_progress' and new.status in ('submitted','disputed'))
        or (old.status = 'revision_requested' and new.status in ('in_progress','submitted','disputed'))
        or (old.status = 'submitted' and new.status = 'disputed');
    end if;
    if not ok then raise exception 'You can''t move this collaboration to that status.'; end if;
    if new.status = 'completed' then new.completed_at = now(); end if;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger collaborations_guard before update on public.collaborations for each row execute function public.collaborations_guard();

create or replace function public.collaborations_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; label text;
begin
  if new.status = old.status then return null; end if;
  label := replace(new.status, '_', ' ');
  perform public.log_collab(new.id, 'status', 'moved the project to ' || label);
  for r in select user_id from public.collaboration_members where collaboration_id = new.id loop
    perform public.v2_notify(r.user_id, auth.uid(), 'collab_status', 'moved "' || new.title || '" to ' || label, '/collaborate/w/' || new.id, 'collab:' || new.id || ':' || new.status || ':' || r.user_id);
  end loop;
  return null;
end $$;
create trigger collaborations_after_update after update on public.collaborations for each row execute function public.collaborations_after_update();

create or replace function public.applications_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.v2_campaigns; collab uuid; cname text;
begin
  select * into c from public.v2_campaigns where id = new.campaign_id;
  if tg_op = 'INSERT' then
    perform set_config('qola.internal', 'on', true);
    update public.v2_campaigns set applications_count = applications_count + 1 where id = new.campaign_id;
    perform set_config('qola.internal', 'off', true);
    if new.status = 'submitted' then
      perform public.v2_notify(c.brand_id, new.creator_id, 'application', 'applied to "' || c.title || '"', '/collaborate/c/' || c.id, 'application:' || new.id);
    else
      perform public.v2_notify(new.creator_id, c.brand_id, 'invite', 'invited you to collaborate on "' || c.title || '"', '/collaborate/c/' || c.id, 'invite:' || new.id);
    end if;
    return null;
  end if;

  if new.status = old.status then return null; end if;

  if new.status = 'accepted' then
    select id into collab from public.collaborations where campaign_id = c.id;
    if collab is null then
      insert into public.collaborations (campaign_id, title, brand_id) values (c.id, c.title, c.brand_id) returning id into collab;
      insert into public.collaboration_members (collaboration_id, user_id, role) values (collab, c.brand_id, 'brand') on conflict do nothing;
    end if;
    insert into public.collaboration_members (collaboration_id, user_id, role) values (collab, new.creator_id, 'creator') on conflict do nothing;
    select display_name into cname from public.v2_profiles where id = new.creator_id;
    insert into public.collaboration_activity (collaboration_id, actor_id, kind, body) values (collab, auth.uid(), 'member', coalesce(cname, 'A creator') || ' joined the collaboration');
  end if;

  if new.status in ('shortlisted','accepted','rejected') and old.status <> 'invited' then
    perform public.v2_notify(new.creator_id, c.brand_id, 'application_status',
      case new.status when 'accepted' then 'accepted your application for "' || c.title || '"'
                      when 'rejected' then 'declined your application for "' || c.title || '"'
                      else 'shortlisted you for "' || c.title || '"' end,
      case when new.status = 'accepted' then '/collaborate/w/' || collab else '/collaborate/c/' || c.id end,
      'appstatus:' || new.id || ':' || new.status);
  elsif new.status in ('accepted','declined') and old.status = 'invited' then
    perform public.v2_notify(c.brand_id, new.creator_id, 'application_status',
      case new.status when 'accepted' then 'accepted your invitation to "' || c.title || '"' else 'declined your invitation to "' || c.title || '"' end,
      case when new.status = 'accepted' then '/collaborate/w/' || collab else '/collaborate/c/' || c.id end,
      'appstatus:' || new.id || ':' || new.status);
  elsif new.status = 'withdrawn' then
    perform public.v2_notify(c.brand_id, new.creator_id, 'application_status', 'withdrew their application for "' || c.title || '"', '/collaborate/c/' || c.id, 'appstatus:' || new.id || ':withdrawn');
  end if;
  return null;
end $$;
create trigger applications_after after insert or update on public.v2_applications for each row execute function public.applications_after();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  due_date date,
  done boolean not null default false,
  created_by uuid references public.v2_profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  assignee_id uuid references public.v2_profiles(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  due_date date,
  created_by uuid references public.v2_profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'pending' check (status in ('pending','submitted','approved','revision_requested')),
  link text check (link is null or char_length(link) <= 500),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.collaboration_files (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  uploader_id uuid not null references public.v2_profiles(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  path text not null,
  size integer not null default 0,
  mime text,
  created_at timestamptz not null default now()
);
create index milestones_collab_idx on public.milestones (collaboration_id);
create index tasks_collab_idx on public.tasks (collaboration_id);
create index deliverables_collab_idx on public.deliverables (collaboration_id);
create index collab_files_idx on public.collaboration_files (collaboration_id, created_at desc);

grant select, insert, update, delete on public.milestones, public.tasks, public.deliverables to authenticated;
grant select, insert, delete on public.collaboration_files to authenticated;
grant all on public.milestones, public.tasks, public.deliverables, public.collaboration_files to service_role;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.deliverables enable row level security;
alter table public.collaboration_files enable row level security;

create policy "Members read milestones" on public.milestones for select to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members add milestones" on public.milestones for insert to authenticated with check (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members edit milestones" on public.milestones for update to authenticated using (public.is_collab_member(collaboration_id, auth.uid())) with check (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members delete milestones" on public.milestones for delete to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));

create policy "Members read tasks" on public.tasks for select to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members add tasks" on public.tasks for insert to authenticated with check (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members edit tasks" on public.tasks for update to authenticated using (public.is_collab_member(collaboration_id, auth.uid())) with check (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members delete tasks" on public.tasks for delete to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));

create policy "Members read deliverables" on public.deliverables for select to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Brand adds deliverables" on public.deliverables for insert to authenticated with check (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members update deliverables" on public.deliverables for update to authenticated using (public.is_collab_member(collaboration_id, auth.uid())) with check (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Brand deletes deliverables" on public.deliverables for delete to authenticated using (public.collab_role(collaboration_id, auth.uid()) = 'brand');

create policy "Members read files" on public.collaboration_files for select to authenticated using (public.is_collab_member(collaboration_id, auth.uid()));
create policy "Members upload files" on public.collaboration_files for insert to authenticated with check (uploader_id = auth.uid() and public.is_collab_member(collaboration_id, auth.uid()));
create policy "Uploader deletes files" on public.collaboration_files for delete to authenticated using (uploader_id = auth.uid());

create or replace function public.workspace_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare role text := public.collab_role(new.collaboration_id, auth.uid());
begin
  if tg_op = 'UPDATE' then new.collaboration_id = old.collaboration_id; new.created_at = old.created_at; end if;
  if tg_table_name = 'tasks' then
    if new.assignee_id is not null and not public.is_collab_member(new.collaboration_id, new.assignee_id) then
      raise exception 'Tasks can only be assigned to people in this collaboration.';
    end if;
  elsif tg_table_name = 'deliverables' then
    if tg_op = 'INSERT' then new.status = 'pending'; end if;
    if tg_op = 'UPDATE' and new.status <> old.status then
      if new.status in ('approved','revision_requested') and role <> 'brand' then
        raise exception 'Only the brand can approve deliverables.';
      end if;
      if new.status = 'submitted' then new.submitted_at = now(); end if;
      if new.status in ('approved','revision_requested') then new.reviewed_at = now(); end if;
    end if;
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on public.tasks for each row execute function public.workspace_guard();
create trigger deliverables_guard before insert or update on public.deliverables for each row execute function public.workspace_guard();
create trigger milestones_guard before insert or update on public.milestones for each row execute function public.workspace_guard();

create or replace function public.workspace_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select title into t from public.collaborations where id = new.collaboration_id;
  if tg_table_name = 'milestones' then
    if tg_op = 'INSERT' then perform public.log_collab(new.collaboration_id, 'milestone', 'added milestone "' || new.title || '"');
    elsif new.done and not old.done then perform public.log_collab(new.collaboration_id, 'milestone', 'completed milestone "' || new.title || '"'); end if;
  elsif tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then perform public.log_collab(new.collaboration_id, 'task', 'added task "' || new.title || '"');
    elsif new.status <> old.status then perform public.log_collab(new.collaboration_id, 'task', 'moved task "' || new.title || '" to ' || replace(new.status, '_', ' ')); end if;
    if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
      perform public.v2_notify(new.assignee_id, auth.uid(), 'task', 'assigned you "' || new.title || '" in ' || t, '/collaborate/w/' || new.collaboration_id, 'task:' || new.id || ':' || new.assignee_id);
    end if;
  elsif tg_table_name = 'deliverables' then
    if tg_op = 'INSERT' then perform public.log_collab(new.collaboration_id, 'deliverable', 'added deliverable "' || new.title || '"');
    elsif new.status <> old.status then perform public.log_collab(new.collaboration_id, 'deliverable', 'marked "' || new.title || '" as ' || replace(new.status, '_', ' ')); end if;
  elsif tg_table_name = 'collaboration_files' then
    perform public.log_collab(new.collaboration_id, 'file', 'uploaded ' || new.name);
  end if;
  return null;
end $$;
create trigger milestones_activity after insert or update on public.milestones for each row execute function public.workspace_activity();
create trigger tasks_activity after insert or update on public.tasks for each row execute function public.workspace_activity();
create trigger deliverables_activity after insert or update on public.deliverables for each row execute function public.workspace_activity();
create trigger files_activity after insert on public.collaboration_files for each row execute function public.workspace_activity();

alter publication supabase_realtime add table public.collaboration_activity;

create or replace function public.private_path_allowed(_name text, _uid uuid, _write boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(_name, '/'); scope uuid;
begin
  if array_length(parts, 1) < 4 then return false; end if;
  begin scope := parts[2]::uuid; exception when others then return false; end;
  if _write and parts[3] <> _uid::text then return false; end if;
  if parts[1] = 'conv' then return public.is_conversation_member(scope, _uid);
  elsif parts[1] = 'collab' then return public.is_collab_member(scope, _uid);
  end if;
  return false;
end $$;

create policy "Members read private files" on storage.objects for select to authenticated
  using (bucket_id = 'private' and public.private_path_allowed(name, auth.uid(), false));
create policy "Members upload private files" on storage.objects for insert to authenticated
  with check (bucket_id = 'private' and public.private_path_allowed(name, auth.uid(), true));
create policy "Uploader deletes private files" on storage.objects for delete to authenticated
  using (bucket_id = 'private' and public.private_path_allowed(name, auth.uid(), true));

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.v2_profiles(id) on delete cascade,
  to_address text not null default '' check (char_length(to_address) <= 320),
  subject text not null default '' check (char_length(subject) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  folder text not null default 'drafts' check (folder in ('inbox','sent','drafts','archived')),
  status text not null default 'draft' check (status in ('draft','queued','sent','failed')),
  is_read boolean not null default true,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_owner_idx on public.email_messages (owner_id, folder, updated_at desc);
grant select, insert, update, delete on public.email_messages to authenticated;
grant all on public.email_messages to service_role;
alter table public.email_messages enable row level security;
create policy "Own email read" on public.email_messages for select to authenticated using (owner_id = auth.uid());
create policy "Own email write" on public.email_messages for insert to authenticated with check (owner_id = auth.uid() and status = 'draft' and folder in ('drafts','archived'));
create policy "Own email update" on public.email_messages for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Own email delete" on public.email_messages for delete to authenticated using (owner_id = auth.uid());

create or replace function public.email_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('qola.internal', true), 'off') <> 'on' then
    new.status = old.status; new.sent_at = old.sent_at; new.error = old.error; new.owner_id = old.owner_id;
    if new.folder = 'sent' and old.folder <> 'sent' then raise exception 'Emails can only be moved to Sent by the delivery service.'; end if;
    if old.folder = 'sent' then new.to_address = old.to_address; new.subject = old.subject; new.body = old.body; end if;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger email_guard before update on public.email_messages for each row execute function public.email_guard();