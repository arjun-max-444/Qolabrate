CREATE TABLE public.creator_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  level text NOT NULL DEFAULT 'intermediate' CHECK (level IN ('beginner','intermediate','advanced','expert')),
  years smallint NOT NULL DEFAULT 0 CHECK (years BETWEEN 0 AND 50),
  tools text[] NOT NULL DEFAULT '{}',
  link text NOT NULL DEFAULT '' CHECK (link = '' OR link ~* '^https?://'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_skills_user_idx ON public.creator_skills(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_skills TO authenticated;
GRANT ALL ON public.creator_skills TO service_role;
ALTER TABLE public.creator_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read skills" ON public.creator_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creators add own skills" ON public.creator_skills FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(),'creator'));
CREATE POLICY "Creators edit own skills" ON public.creator_skills FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Creators delete own skills" ON public.creator_skills FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.creator_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','changes_requested','approved','rejected')),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  decision_reason text NOT NULL DEFAULT '',
  missing_items text[] NOT NULL DEFAULT '{}',
  ai_review_status text NOT NULL DEFAULT 'none' CHECK (ai_review_status IN ('none','running','done','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_verification_requests TO authenticated;
GRANT ALL ON public.creator_verification_requests TO service_role;
ALTER TABLE public.creator_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators read own request" ON public.creator_verification_requests FOR SELECT TO authenticated USING (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.creator_verification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('portfolio','project','public_profile','testimonial','certificate','business_document','other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  url text NOT NULL DEFAULT '' CHECK (url = '' OR url ~* '^https?://'),
  storage_path text,
  file_name text NOT NULL DEFAULT '',
  related_skill text NOT NULL DEFAULT '',
  related_project_id uuid REFERENCES public.creator_projects(id) ON DELETE SET NULL,
  permission_to_share boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','accepted','needs_more','rejected')),
  admin_note text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (url <> '' OR storage_path IS NOT NULL)
);
CREATE INDEX cve_creator_idx ON public.creator_verification_evidence(creator_id);
GRANT SELECT, INSERT, DELETE ON public.creator_verification_evidence TO authenticated;
GRANT ALL ON public.creator_verification_evidence TO service_role;
ALTER TABLE public.creator_verification_evidence ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.verification_editable(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.creator_verification_requests WHERE creator_id = _uid AND status IN ('submitted','under_review','approved'))
$$;
CREATE POLICY "Creators read own evidence" ON public.creator_verification_evidence FOR SELECT TO authenticated USING (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Creators add own evidence" ON public.creator_verification_evidence FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND public.has_role(auth.uid(),'creator') AND public.verification_editable(auth.uid()) AND review_status = 'pending' AND admin_note = '' AND (storage_path IS NULL OR storage_path LIKE auth.uid()::text || '/%'));
CREATE POLICY "Creators remove own evidence" ON public.creator_verification_evidence FOR DELETE TO authenticated USING (creator_id = auth.uid() AND public.verification_editable(auth.uid()));

CREATE TABLE public.creator_ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.creator_verification_requests(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  report jsonb NOT NULL,
  review_version int NOT NULL DEFAULT 1,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.creator_ai_reviews TO service_role;
ALTER TABLE public.creator_ai_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.creator_verification_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.creator_verification_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  previous_status text,
  new_status text,
  reason text NOT NULL DEFAULT '',
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cval_request_idx ON public.creator_verification_audit_logs(request_id, created_at);
GRANT ALL ON public.creator_verification_audit_logs TO service_role;
ALTER TABLE public.creator_verification_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.block_audit_changes() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Audit history cannot be changed'; END; $$;
CREATE TRIGGER cval_immutable BEFORE UPDATE OR DELETE ON public.creator_verification_audit_logs FOR EACH ROW EXECUTE FUNCTION public.block_audit_changes();

CREATE OR REPLACE FUNCTION public.is_verified_creator(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.creator_verification_requests WHERE creator_id = _id AND status = 'approved')
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_creator(uuid) TO authenticated, anon;

CREATE POLICY "Creators upload own evidence files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Creators read own evidence files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Creators delete own evidence files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);