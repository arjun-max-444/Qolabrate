ALTER TABLE public.v2_campaigns
  ADD COLUMN IF NOT EXISTS goals text,
  ADD COLUMN IF NOT EXISTS usage_rights text;
ALTER TABLE public.v2_campaigns
  ADD CONSTRAINT campaigns_goals_len CHECK (goals IS NULL OR char_length(goals) <= 1000),
  ADD CONSTRAINT campaigns_usage_rights_len CHECK (usage_rights IS NULL OR char_length(usage_rights) <= 500);
ALTER TABLE public.v2_campaigns DROP CONSTRAINT v2_campaigns_compensation_type_check;
ALTER TABLE public.v2_campaigns ADD CONSTRAINT campaigns_compensation_type_check
  CHECK (compensation_type = ANY (ARRAY['paid','barter','affiliate','ugc','unpaid','negotiable']));

ALTER TABLE public.v2_applications ADD COLUMN IF NOT EXISTS proposed_price integer;
ALTER TABLE public.v2_applications ADD CONSTRAINT applications_proposed_price_range CHECK (proposed_price IS NULL OR (proposed_price >= 0 AND proposed_price <= 100000000));

CREATE OR REPLACE FUNCTION public.applications_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c public.v2_campaigns; me uuid := auth.uid(); target public.v2_profiles; owner boolean; filled integer;
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
      new.proposed_price = null;
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
    if new.status = 'accepted' then
      select count(*) into filled from public.v2_applications where campaign_id = old.campaign_id and status = 'accepted';
      if filled >= c.creators_needed then
        raise exception 'All % creator slots on this campaign are filled.', c.creators_needed;
      end if;
    end if;
  end if;
  if me <> old.creator_id or old.status <> 'submitted' then
    new.proposal = old.proposal; new.rate = old.rate; new.portfolio_item_ids = old.portfolio_item_ids; new.proposed_price = old.proposed_price;
  end if;
  new.updated_at = now();
  return new;
end $$;

ALTER TABLE public.collaborations DROP CONSTRAINT collaborations_status_check;
ALTER TABLE public.collaborations ADD CONSTRAINT collaborations_status_check
  CHECK (status = ANY (ARRAY['accepted','in_progress','submitted','revision_requested','approved','completed','cancelled','disputed']));

CREATE OR REPLACE FUNCTION public.collaborations_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare role text := public.collab_role(old.id, auth.uid()); ok boolean := false;
begin
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;
  new.campaign_id = old.campaign_id; new.brand_id = old.brand_id; new.title = old.title; new.created_at = old.created_at;
  if new.status <> old.status then
    if old.status in ('completed','cancelled') then raise exception 'This collaboration is closed.'; end if;
    if role = 'brand' then
      ok := (old.status = 'accepted' and new.status in ('in_progress','cancelled'))
        or (old.status = 'in_progress' and new.status in ('cancelled','disputed','submitted'))
        or (old.status = 'submitted' and new.status in ('approved','completed','revision_requested','disputed'))
        or (old.status = 'revision_requested' and new.status in ('in_progress','cancelled','disputed'))
        or (old.status = 'approved' and new.status in ('completed','disputed'))
        or (old.status = 'disputed' and new.status in ('in_progress','completed','cancelled'));
    elsif role = 'creator' then
      ok := (old.status = 'accepted' and new.status = 'in_progress')
        or (old.status = 'in_progress' and new.status in ('submitted','disputed'))
        or (old.status = 'revision_requested' and new.status in ('in_progress','submitted','disputed'))
        or (old.status = 'submitted' and new.status = 'disputed')
        or (old.status = 'approved' and new.status = 'disputed');
    end if;
    if not ok then raise exception 'You can''t move this collaboration to that status.'; end if;
    if new.status = 'completed' then new.completed_at = now(); end if;
  end if;
  new.updated_at = now();
  return new;
end $$;

ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.v2_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS revision_limit integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS revisions_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS final_url text,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.deliverables
  ADD CONSTRAINT deliverables_revision_limit_range CHECK (revision_limit >= 0 AND revision_limit <= 10),
  ADD CONSTRAINT deliverables_revisions_used_range CHECK (revisions_used >= 0 AND revisions_used <= 10),
  ADD CONSTRAINT deliverables_feedback_len CHECK (feedback IS NULL OR char_length(feedback) <= 2000),
  ADD CONSTRAINT deliverables_final_url_len CHECK (final_url IS NULL OR char_length(final_url) <= 500),
  ADD CONSTRAINT deliverables_proof_url_len CHECK (proof_url IS NULL OR char_length(proof_url) <= 500);
ALTER TABLE public.deliverables DROP CONSTRAINT deliverables_status_check;
ALTER TABLE public.deliverables ADD CONSTRAINT deliverables_status_check
  CHECK (status = ANY (ARRAY['pending','in_progress','submitted','revision_requested','approved','completed']));
CREATE INDEX IF NOT EXISTS deliverables_creator_idx ON public.deliverables (creator_id);

CREATE OR REPLACE FUNCTION public.workspace_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare role text := public.collab_role(new.collaboration_id, auth.uid());
begin
  if tg_op = 'UPDATE' then new.collaboration_id = old.collaboration_id; new.created_at = old.created_at; end if;
  if tg_table_name = 'tasks' then
    if new.assignee_id is not null and not public.is_collab_member(new.collaboration_id, new.assignee_id) then
      raise exception 'Tasks can only be assigned to people in this collaboration.';
    end if;
    return new;
  end if;
  if tg_table_name <> 'deliverables' then return new; end if;
  if coalesce(current_setting('qola.internal', true), 'off') = 'on' then return new; end if;

  if new.creator_id is not null and coalesce(public.collab_role(new.collaboration_id, new.creator_id), '') <> 'creator' then
    raise exception 'Deliverables can only be assigned to a creator in this collaboration.';
  end if;

  if tg_op = 'INSERT' then
    if role <> 'brand' then raise exception 'Only the brand can add deliverables.'; end if;
    new.status = 'pending'; new.revisions_used = 0; new.submitted_at = null; new.reviewed_at = null; new.completed_at = null;
    new.final_url = null; new.proof_url = null; new.link = null; new.feedback = null;
    return new;
  end if;

  new.revisions_used = old.revisions_used; new.submitted_at = old.submitted_at; new.reviewed_at = old.reviewed_at; new.completed_at = old.completed_at;
  if role = 'creator' then
    if old.creator_id is not null and old.creator_id <> auth.uid() then raise exception 'This deliverable belongs to another creator.'; end if;
    new.title = old.title; new.creator_id = old.creator_id; new.due_date = old.due_date; new.revision_limit = old.revision_limit; new.feedback = old.feedback;
    if old.status = 'completed' then new.link = old.link; new.final_url = old.final_url; new.proof_url = old.proof_url; end if;
  elsif role = 'brand' then
    new.link = old.link; new.final_url = old.final_url; new.proof_url = old.proof_url;
    if new.revision_limit < old.revisions_used then raise exception 'The revision limit can''t be lower than revisions already used.'; end if;
  else
    raise exception 'Only members of this collaboration can update deliverables.';
  end if;

  if new.status <> old.status then
    if role = 'creator' then
      if not ((old.status = 'pending' and new.status = 'in_progress')
           or (old.status in ('pending','in_progress','revision_requested') and new.status = 'submitted')) then
        raise exception 'You can''t move this deliverable to that status.';
      end if;
      if new.status = 'submitted' then
        if coalesce(btrim(new.link), '') = '' then raise exception 'Add a link to your draft before submitting it.'; end if;
        new.submitted_at = now();
      end if;
    else
      if old.status = 'submitted' and new.status = 'approved' then
        new.reviewed_at = now();
      elsif old.status = 'submitted' and new.status = 'revision_requested' then
        if old.revisions_used >= old.revision_limit then
          raise exception 'The revision limit (%) for this deliverable has been reached.', old.revision_limit;
        end if;
        if coalesce(btrim(new.feedback), '') = '' then raise exception 'Add feedback so the creator knows what to change.'; end if;
        new.revisions_used = old.revisions_used + 1;
        new.reviewed_at = now();
      elsif old.status = 'approved' and new.status = 'completed' then
        if coalesce(btrim(old.final_url), '') = '' then raise exception 'The creator needs to add the final content link first.'; end if;
        new.completed_at = now();
      else
        raise exception 'You can''t move this deliverable to that status.';
      end if;
    end if;
  end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.applications_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c public.v2_campaigns; collab uuid; cname text; d text;
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
    if not exists (select 1 from public.deliverables where collaboration_id = collab and creator_id = new.creator_id) then
      perform set_config('qola.internal', 'on', true);
      foreach d in array coalesce(c.deliverables, '{}') loop
        insert into public.deliverables (collaboration_id, title, creator_id, due_date)
        values (collab, left(d, 200), new.creator_id, c.deadline);
      end loop;
      perform set_config('qola.internal', 'off', true);
    end if;
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

CREATE OR REPLACE FUNCTION public.deliverables_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare brand uuid; t text;
begin
  if new.status = old.status then return null; end if;
  select brand_id, title into brand, t from public.collaborations where id = new.collaboration_id;
  if new.status = 'submitted' then
    perform public.v2_notify(brand, auth.uid(), 'deliverable', 'submitted "' || new.title || '" for review in ' || t, '/collaborate/w/' || new.collaboration_id, 'deliv:' || new.id || ':submitted:' || new.revisions_used);
  elsif new.status in ('approved','revision_requested','completed') and new.creator_id is not null then
    perform public.v2_notify(new.creator_id, auth.uid(), 'deliverable',
      case new.status when 'approved' then 'approved "' || new.title || '"'
                      when 'completed' then 'confirmed "' || new.title || '" as posted'
                      else 'requested changes to "' || new.title || '"' end || ' in ' || t,
      '/collaborate/w/' || new.collaboration_id, 'deliv:' || new.id || ':' || new.status || ':' || new.revisions_used);
  end if;
  return null;
end $$;
DROP TRIGGER IF EXISTS deliverables_notify ON public.deliverables;
CREATE TRIGGER deliverables_notify AFTER UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.deliverables_notify();

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.v2_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS conversations_campaign_idx ON public.conversations (campaign_id);

CREATE OR REPLACE FUNCTION public.start_conversation(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  if demo then raise exception 'This is a demo profile and can''t receive messages.'; end if;
  if perm = 'nobody' then raise exception 'This account isn''t accepting messages.'; end if;
  if perm = 'following' and not exists (select 1 from public.follows where follower_id = _other and following_id = me) then
    raise exception 'This account only accepts messages from people they follow.';
  end if;
  insert into public.conversations default values returning id into conv;
  insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, _other);
  return conv;
end $$;

CREATE OR REPLACE FUNCTION public.start_campaign_conversation(_campaign uuid, _other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare me uuid := auth.uid(); c public.v2_campaigns; creator uuid; conv uuid;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  select * into c from public.v2_campaigns where id = _campaign;
  if not found then raise exception 'Campaign not found.'; end if;
  if c.is_demo then raise exception 'Demo campaigns can''t be messaged.'; end if;
  if me = c.brand_id then creator := _other;
  elsif _other = c.brand_id then creator := me;
  else raise exception 'Campaign chats are between the brand and a creator.'; end if;
  if not exists (select 1 from public.v2_applications where campaign_id = _campaign and creator_id = creator and status not in ('withdrawn')) then
    raise exception 'You can message about this campaign once there''s an application or invitation.';
  end if;
  if public.is_blocked_between(me, _other) then raise exception 'You can''t message this account.'; end if;
  select cv.id into conv from public.conversations cv
    where cv.campaign_id = _campaign
      and exists (select 1 from public.conversation_members m where m.conversation_id = cv.id and m.user_id = me)
      and exists (select 1 from public.conversation_members m where m.conversation_id = cv.id and m.user_id = _other)
    limit 1;
  if conv is not null then return conv; end if;
  insert into public.conversations (campaign_id) values (_campaign) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, _other);
  return conv;
end $$;
REVOKE ALL ON FUNCTION public.start_campaign_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_campaign_conversation(uuid, uuid) TO authenticated;