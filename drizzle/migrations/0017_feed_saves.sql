CREATE TABLE public.feed_saves (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.feed_saves TO authenticated;
GRANT ALL ON public.feed_saves TO service_role;
ALTER TABLE public.feed_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own saves" ON public.feed_saves FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles fp WHERE fp.id = profile_id AND fp.user_id = auth.uid()));
CREATE POLICY "Add own saves" ON public.feed_saves FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles fp WHERE fp.id = profile_id AND fp.user_id = auth.uid()));
CREATE POLICY "Remove own saves" ON public.feed_saves FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles fp WHERE fp.id = profile_id AND fp.user_id = auth.uid()));