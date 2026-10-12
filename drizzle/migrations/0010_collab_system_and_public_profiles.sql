
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Public profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS starting_rate numeric,
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.make_username(_base text, _id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b text; u text; n int := 0; BEGIN
  b := trim(both '-' from regexp_replace(lower(coalesce(_base,'')), '[^a-z0-9]+', '-', 'g'));
  IF length(b) < 3 THEN b := 'member-' || substr(replace(_id::text,'-',''),1,6); END IF;
  b := left(b, 24); u := b;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = u AND id <> _id) LOOP n := n + 1; u := b || '-' || n; END LOOP;
  RETURN u; END $$;

UPDATE public.profiles SET username = public.make_username(coalesce(nullif(full_name,''), split_part(email,'@',1)), id) WHERE username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (username);

CREATE OR REPLACE FUNCTION public.profile_username_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := public.make_username(coalesce(nullif(NEW.full_name,''), split_part(NEW.email,'@',1)), NEW.id);
  ELSE
    NEW.username := lower(NEW.username);
    IF NEW.username !~ '^[a-z0-9][a-z0-9-]{2,29}$' THEN RAISE EXCEPTION 'Username must be 3-30 letters, numbers or dashes'; END IF;
  END IF;
  RETURN NEW; END $$;
DROP TRIGGER IF EXISTS profile_username_default ON public.profiles;
CREATE TRIGGER profile_username_default BEFORE INSERT OR UPDATE OF username ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_username_default();

-- Collab settings
CREATE TABLE public.collab_settings (
  creator_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  open_to_collabs boolean NOT NULL DEFAULT true,
  min_budget numeric NOT NULL DEFAULT 0 CHECK (min_budget >= 0),
  daily_limit_per_brand integer NOT NULL DEFAULT 3 CHECK (daily_limit_per_brand BETWEEN 1 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collab_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.collab_settings TO authenticated;
GRANT ALL ON public.collab_settings TO service_role;
ALTER TABLE public.collab_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_settings_read ON public.collab_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY collab_settings_owner_ins ON public.collab_settings FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid() AND public.has_role(auth.uid(),'creator'));
CREATE POLICY collab_settings_owner_upd ON public.collab_settings FOR UPDATE TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- Collabs
CREATE TABLE public.collabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('quick_task','project','retainer','gift_barter')),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  brief text NOT NULL CHECK (length(brief) BETWEEN 10 AND 5000),
  budget_min numeric NOT NULL DEFAULT 0 CHECK (budget_min >= 0),
  budget_max numeric NOT NULL DEFAULT 0 CHECK (budget_max >= budget_min),
  deadline date,
  reference_links text[] NOT NULL DEFAULT '{}',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','countered','active','completed','cancelled')),
  counter_budget_min numeric, counter_budget_max numeric, counter_deadline date, counter_note text,
  cancel_reason text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collabs_creator_idx ON public.collabs (creator_id, status);
CREATE INDEX collabs_brand_idx ON public.collabs (brand_id, status);
GRANT SELECT ON public.collabs TO authenticated;
GRANT ALL ON public.collabs TO service_role;
ALTER TABLE public.collabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY collabs_parties_read ON public.collabs FOR SELECT TO authenticated USING (auth.uid() IN (brand_id, creator_id));

CREATE OR REPLACE FUNCTION public.is_collab_party(_collab uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM collabs WHERE id = _collab AND auth.uid() IN (brand_id, creator_id)) $$;
CREATE OR REPLACE FUNCTION public.collab_unlocked(_collab uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM collabs WHERE id = _collab AND auth.uid() IN (brand_id, creator_id) AND status IN ('accepted','active','completed')) $$;

CREATE TABLE public.collab_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_id uuid NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  position integer NOT NULL DEFAULT 0,
  delivered_at timestamptz, approved_at timestamptz
);
GRANT SELECT ON public.collab_deliverables TO authenticated;
GRANT ALL ON public.collab_deliverables TO service_role;
ALTER TABLE public.collab_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_deliverables_read ON public.collab_deliverables FOR SELECT TO authenticated USING (public.is_collab_party(collab_id));

CREATE TABLE public.collab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_id uuid NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 4000),
  file_path text, file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collab_messages_idx ON public.collab_messages (collab_id, created_at);
GRANT SELECT, INSERT ON public.collab_messages TO authenticated;
GRANT ALL ON public.collab_messages TO service_role;
ALTER TABLE public.collab_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.collab_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.collab_blocks TO authenticated;
GRANT ALL ON public.collab_blocks TO service_role;
ALTER TABLE public.collab_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_blocks_owner ON public.collab_blocks FOR ALL TO authenticated USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM collab_blocks WHERE (blocker_id=_a AND blocked_id=_b) OR (blocker_id=_b AND blocked_id=_a)) $$;

CREATE POLICY collab_messages_read ON public.collab_messages FOR SELECT TO authenticated USING (public.collab_unlocked(collab_id));
CREATE POLICY collab_messages_send ON public.collab_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND public.collab_unlocked(collab_id)
  AND NOT EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = collab_id AND (c.status = 'completed' OR public.is_blocked(c.brand_id, c.creator_id))));

CREATE TABLE public.collab_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_id uuid NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.collab_reports TO authenticated;
GRANT ALL ON public.collab_reports TO service_role;
ALTER TABLE public.collab_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_reports_insert ON public.collab_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND public.is_collab_party(collab_id));

CREATE TABLE public.collab_reviews (
  collab_id uuid NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collab_id, reviewer_id)
);
GRANT SELECT ON public.collab_reviews TO anon;
GRANT SELECT, INSERT ON public.collab_reviews TO authenticated;
GRANT ALL ON public.collab_reviews TO service_role;
ALTER TABLE public.collab_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_reviews_read ON public.collab_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY collab_reviews_insert ON public.collab_reviews FOR INSERT TO authenticated WITH CHECK (
  reviewer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = collab_id AND c.status = 'completed'
    AND ((c.brand_id = auth.uid() AND reviewee_id = c.creator_id) OR (c.creator_id = auth.uid() AND reviewee_id = c.brand_id))));

-- Expire stale requests
CREATE OR REPLACE FUNCTION public.expire_collabs()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE collabs SET status='cancelled', cancel_reason='expired', updated_at=now()
  WHERE status IN ('pending','countered') AND expires_at < now() $$;

-- Send a request
CREATE OR REPLACE FUNCTION public.send_collab(_creator uuid, _plan text, _title text, _brief text, _min numeric, _max numeric, _deadline date, _deliverables text[], _links text[], _message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s collab_settings; new_id uuid; lim int; d text; i int := 0; BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'brand') THEN RAISE EXCEPTION 'Only brand accounts can send collab requests'; END IF;
  IF NOT has_role(_creator,'creator') THEN RAISE EXCEPTION 'Requests can only be sent to creators'; END IF;
  IF is_blocked(auth.uid(), _creator) THEN RAISE EXCEPTION 'This creator is not accepting requests from you'; END IF;
  SELECT * INTO s FROM collab_settings WHERE creator_id=_creator;
  IF s.creator_id IS NOT NULL AND NOT s.open_to_collabs THEN RAISE EXCEPTION 'This creator is not open to collabs right now'; END IF;
  IF _plan <> 'gift_barter' AND coalesce(_max,0) < coalesce(s.min_budget,0) THEN RAISE EXCEPTION 'Budget is below this creator''s minimum of % USD', s.min_budget; END IF;
  lim := coalesce(s.daily_limit_per_brand, 3);
  IF (SELECT count(*) FROM collabs WHERE brand_id=auth.uid() AND creator_id=_creator AND created_at > now()-interval '1 day') >= lim THEN
    RAISE EXCEPTION 'Daily request limit reached for this creator (% per day)', lim; END IF;
  IF coalesce(array_length(_deliverables,1),0) = 0 THEN RAISE EXCEPTION 'Add at least one deliverable'; END IF;
  INSERT INTO collabs(brand_id,creator_id,plan_type,title,brief,budget_min,budget_max,deadline,reference_links,message)
  VALUES (auth.uid(),_creator,_plan,trim(_title),trim(_brief),coalesce(_min,0),coalesce(_max,0),_deadline,coalesce(_links[1:10],'{}'),left(coalesce(_message,''),2000))
  RETURNING id INTO new_id;
  FOREACH d IN ARRAY _deliverables[1:30] LOOP
    IF trim(d) <> '' THEN INSERT INTO collab_deliverables(collab_id,label,position) VALUES (new_id,left(trim(d),200),i); i := i+1; END IF;
  END LOOP;
  PERFORM notify(_creator,'New collab request','A brand invited you: '||left(_title,80),'/collabs');
  RETURN new_id; END $$;

-- Status actions
CREATE OR REPLACE FUNCTION public.collab_action(_id uuid, _action text, _min numeric DEFAULT NULL, _max numeric DEFAULT NULL, _deadline date DEFAULT NULL, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c collabs; me uuid := auth.uid(); BEGIN
  PERFORM expire_collabs();
  SELECT * INTO c FROM collabs WHERE id=_id FOR UPDATE;
  IF c.id IS NULL OR me NOT IN (c.brand_id,c.creator_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF me=c.creator_id AND _action='accept' AND c.status='pending' THEN
    UPDATE collabs SET status='active',accepted_at=now(),updated_at=now() WHERE id=_id;
    PERFORM notify(c.brand_id,'Collab accepted','"'||left(c.title,80)||'" was accepted. The workspace is open.','/collabs/'||_id);
  ELSIF me=c.creator_id AND _action='decline' AND c.status IN ('pending','countered') THEN
    UPDATE collabs SET status='declined',updated_at=now() WHERE id=_id;
    PERFORM notify(c.brand_id,'Collab declined','"'||left(c.title,80)||'" was declined.','/collabs');
  ELSIF me=c.creator_id AND _action='counter' AND c.status='pending' THEN
    IF coalesce(_max,0) < coalesce(_min,0) THEN RAISE EXCEPTION 'Invalid budget range'; END IF;
    UPDATE collabs SET status='countered',counter_budget_min=_min,counter_budget_max=_max,counter_deadline=_deadline,counter_note=left(coalesce(_note,''),2000),expires_at=now()+interval '7 days',updated_at=now() WHERE id=_id;
    PERFORM notify(c.brand_id,'Counter offer','The creator countered "'||left(c.title,80)||'".','/collabs');
  ELSIF me=c.brand_id AND _action='accept_counter' AND c.status='countered' THEN
    UPDATE collabs SET status='active',budget_min=coalesce(counter_budget_min,budget_min),budget_max=coalesce(counter_budget_max,budget_max),deadline=coalesce(counter_deadline,deadline),accepted_at=now(),updated_at=now() WHERE id=_id;
    PERFORM notify(c.creator_id,'Counter accepted','"'||left(c.title,80)||'" is now active.','/collabs/'||_id);
  ELSIF me=c.brand_id AND _action='cancel' AND c.status IN ('pending','countered','active') THEN
    UPDATE collabs SET status='cancelled',cancel_reason='cancelled by brand',updated_at=now() WHERE id=_id;
    PERFORM notify(c.creator_id,'Collab cancelled','"'||left(c.title,80)||'" was cancelled.','/collabs');
  ELSIF me=c.brand_id AND _action='complete' AND c.status='active' THEN
    IF EXISTS (SELECT 1 FROM collab_deliverables WHERE collab_id=_id AND approved_at IS NULL) THEN RAISE EXCEPTION 'Approve every deliverable first'; END IF;
    UPDATE collabs SET status='completed',completed_at=now(),updated_at=now() WHERE id=_id;
    PERFORM notify(c.creator_id,'Collab completed','"'||left(c.title,80)||'" is complete. Leave a review.','/collabs/'||_id);
  ELSE RAISE EXCEPTION 'This action is not available'; END IF;
  RETURN (SELECT status FROM collabs WHERE id=_id); END $$;

CREATE OR REPLACE FUNCTION public.deliverable_action(_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d collab_deliverables; c collabs; BEGIN
  SELECT * INTO d FROM collab_deliverables WHERE id=_id;
  SELECT * INTO c FROM collabs WHERE id=d.collab_id;
  IF c.id IS NULL OR c.status <> 'active' THEN RAISE EXCEPTION 'Collab is not active'; END IF;
  IF _action='deliver' AND auth.uid()=c.creator_id THEN
    UPDATE collab_deliverables SET delivered_at=now() WHERE id=_id;
    PERFORM notify(c.brand_id,'Deliverable ready','"'||left(d.label,80)||'" was marked delivered.','/collabs/'||c.id);
  ELSIF _action='undeliver' AND auth.uid()=c.creator_id AND d.approved_at IS NULL THEN
    UPDATE collab_deliverables SET delivered_at=NULL WHERE id=_id;
  ELSIF _action='approve' AND auth.uid()=c.brand_id AND d.delivered_at IS NOT NULL THEN
    UPDATE collab_deliverables SET approved_at=now() WHERE id=_id;
    PERFORM notify(c.creator_id,'Deliverable approved','"'||left(d.label,80)||'" was approved.','/collabs/'||c.id);
  ELSE RAISE EXCEPTION 'This action is not available'; END IF; END $$;

-- Message notifications
CREATE OR REPLACE FUNCTION public.notify_collab_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c collabs; BEGIN
  SELECT * INTO c FROM collabs WHERE id=NEW.collab_id;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = CASE WHEN NEW.sender_id=c.brand_id THEN c.creator_id ELSE c.brand_id END
     AND link='/collabs/'||c.id AND read_at IS NULL AND title='New message') THEN
    PERFORM notify(CASE WHEN NEW.sender_id=c.brand_id THEN c.creator_id ELSE c.brand_id END,'New message','New message in "'||left(c.title,80)||'".','/collabs/'||c.id);
  END IF;
  RETURN NEW; END $$;
CREATE TRIGGER notify_collab_message AFTER INSERT ON public.collab_messages FOR EACH ROW EXECUTE FUNCTION public.notify_collab_message();

-- Public profile reads (no email / whatsapp)
CREATE OR REPLACE FUNCTION public.public_profile(_username text DEFAULT NULL, _id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, username text, role text, full_name text, avatar_path text, cover_path text, bio text, location text, website text,
  social_links jsonb, skills text[], tools text[], starting_rate numeric, company_name text, industry text, open_to_collabs boolean,
  min_budget numeric, created_at timestamptz, rating numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, r.role::text, p.full_name, p.avatar_path, p.cover_path, p.bio, p.location, p.website, p.social_links, p.skills, p.tools,
    p.starting_rate, p.company_name, p.industry, coalesce(s.open_to_collabs, true), coalesce(s.min_budget, 0), p.created_at,
    (SELECT round(avg(rating)::numeric,1) FROM collab_reviews WHERE reviewee_id=p.id), (SELECT count(*) FROM collab_reviews WHERE reviewee_id=p.id)
  FROM profiles p LEFT JOIN user_roles r ON r.user_id=p.id LEFT JOIN collab_settings s ON s.creator_id=p.id
  WHERE p.account_status='active' AND r.role IN ('creator','brand')
    AND ((_username IS NOT NULL AND p.username=lower(_username)) OR (_id IS NOT NULL AND p.id=_id)) LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION public.public_profile(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE username=lower(_username) AND id <> coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000')) $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.collab_messages;

-- Collab file storage policies (bucket created separately)
CREATE POLICY collab_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='collab-files' AND public.collab_unlocked(((storage.foldername(name))[1])::uuid));
CREATE POLICY collab_files_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='collab-files' AND public.collab_unlocked(((storage.foldername(name))[1])::uuid));
CREATE POLICY avatars_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id='avatars');
CREATE POLICY avatars_write ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
