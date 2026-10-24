CREATE TABLE public.creator_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  client text NOT NULL DEFAULT '' CHECK (char_length(client) <= 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  link text NOT NULL DEFAULT '' CHECK (link = '' OR link ~* '^https?://'),
  year smallint CHECK (year BETWEEN 1990 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_projects_user_idx ON public.creator_projects(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_projects TO authenticated;
GRANT ALL ON public.creator_projects TO service_role;
ALTER TABLE public.creator_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read projects" ON public.creator_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creators add own projects" ON public.creator_projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'creator'));
CREATE POLICY "Creators edit own projects" ON public.creator_projects FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Creators delete own projects" ON public.creator_projects FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.brand_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','growth','pro')),
  renews_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brand_subscriptions TO authenticated;
GRANT ALL ON public.brand_subscriptions TO service_role;
ALTER TABLE public.brand_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brands read own plan" ON public.brand_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());