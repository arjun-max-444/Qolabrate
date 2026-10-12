ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS logo_url text, ADD COLUMN IF NOT EXISTS about text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.initialize_account()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
INSERT INTO public.profiles(id,email,full_name) VALUES(NEW.id,coalesce(NEW.email,''),coalesce(NEW.raw_user_meta_data->>'full_name',''));
INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id, CASE WHEN NEW.raw_user_meta_data->>'signup_role'='brand' THEN 'brand'::app_role ELSE 'creator'::app_role END);
RETURN NEW; END; $$;

-- Lets a new account (e.g. Google sign-up) pick creator or brand within 24h of creation. Never admin.
CREATE OR REPLACE FUNCTION public.choose_signup_role(_role app_role)
 RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE cur app_role; created timestamptz; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
IF _role NOT IN ('creator','brand') THEN RAISE EXCEPTION 'Invalid role'; END IF;
SELECT role INTO cur FROM public.user_roles WHERE user_id=auth.uid();
IF cur='admin' THEN RETURN cur; END IF;
SELECT created_at INTO created FROM auth.users WHERE id=auth.uid();
IF created < now() - interval '24 hours' THEN RETURN cur; END IF;
INSERT INTO public.user_roles(user_id,role) VALUES(auth.uid(),_role) ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role;
RETURN _role; END; $$;
REVOKE ALL ON FUNCTION public.choose_signup_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_signup_role(app_role) TO authenticated;

CREATE TABLE public.creator_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram','youtube')),
  handle text NOT NULL DEFAULT '',
  profile_url text NOT NULL DEFAULT '',
  follower_count integer NOT NULL DEFAULT 0 CHECK (follower_count BETWEEN 0 AND 2000000000),
  avg_views integer CHECK (avg_views >= 0),
  verified boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE (user_id, platform)
);
GRANT SELECT ON public.creator_social_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_social_accounts TO authenticated;
GRANT ALL ON public.creator_social_accounts TO service_role;
ALTER TABLE public.creator_social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_public_read ON public.creator_social_accounts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY social_owner_insert ON public.creator_social_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND verified = false);
CREATE POLICY social_owner_update ON public.creator_social_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND verified = false);
CREATE POLICY social_owner_delete ON public.creator_social_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  platforms text[] NOT NULL DEFAULT '{}',
  deliverables text NOT NULL DEFAULT '',
  min_followers integer NOT NULL DEFAULT 0,
  budget_min numeric,
  budget_max numeric,
  currency text NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','USD')),
  deadline date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_public_open ON public.campaigns FOR SELECT TO anon, authenticated USING (status = 'open' OR brand_id = auth.uid());
CREATE POLICY campaigns_brand_insert ON public.campaigns FOR INSERT TO authenticated WITH CHECK (brand_id = auth.uid() AND public.has_role(auth.uid(),'brand'));
CREATE POLICY campaigns_brand_update ON public.campaigns FOR UPDATE TO authenticated USING (brand_id = auth.uid()) WITH CHECK (brand_id = auth.uid());
CREATE POLICY campaigns_brand_delete ON public.campaigns FOR DELETE TO authenticated USING (brand_id = auth.uid());

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  budget numeric,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_parties_read ON public.offers FOR SELECT TO authenticated USING (brand_id = auth.uid() OR creator_id = auth.uid());
CREATE POLICY offers_brand_insert ON public.offers FOR INSERT TO authenticated WITH CHECK (brand_id = auth.uid() AND status = 'pending' AND public.has_role(auth.uid(),'brand'));
CREATE POLICY offers_parties_update ON public.offers FOR UPDATE TO authenticated USING (brand_id = auth.uid() OR creator_id = auth.uid()) WITH CHECK (brand_id = auth.uid() OR creator_id = auth.uid());

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pitch text NOT NULL DEFAULT '',
  quote numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, creator_id)
);
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY applications_parties_read ON public.applications FOR SELECT TO authenticated USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.brand_id = auth.uid()));
CREATE POLICY applications_creator_insert ON public.applications FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid() AND status = 'pending' AND public.has_role(auth.uid(),'creator') AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.status = 'open'));
CREATE POLICY applications_parties_update ON public.applications FOR UPDATE TO authenticated USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.brand_id = auth.uid()));