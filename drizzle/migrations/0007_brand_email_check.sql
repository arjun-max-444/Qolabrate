ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS email_check text NOT NULL DEFAULT 'unchecked';

CREATE OR REPLACE FUNCTION public.check_brand_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE em text; dom text; site text;
BEGIN
  SELECT lower(email) INTO em FROM profiles WHERE id = NEW.user_id;
  dom := split_part(coalesce(em,''), '@', 2);
  site := lower(regexp_replace(regexp_replace(coalesce(NEW.website,''), '^https?://(www\.)?', ''), '[/:?#].*$', ''));
  IF dom = '' THEN NEW.email_check := 'unchecked';
  ELSIF dom IN ('gmail.com','googlemail.com','yahoo.com','yahoo.in','yahoo.co.in','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','aol.com','proton.me','protonmail.com','zoho.com','rediffmail.com','gmx.com','mail.com','yandex.com') THEN NEW.email_check := 'personal_email';
  ELSIF EXISTS (SELECT 1 FROM profiles p JOIN user_roles r ON r.user_id = p.id AND r.role = 'creator' WHERE lower(p.email) = em AND p.id <> NEW.user_id) THEN NEW.email_check := 'duplicate_creator_email';
  ELSIF site = '' OR NOT (site = dom OR site LIKE '%.' || dom OR dom LIKE '%.' || site) THEN NEW.email_check := 'domain_mismatch';
  ELSE NEW.email_check := 'verified_domain';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_brand_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER check_brand_email BEFORE INSERT OR UPDATE ON public.brand_profiles FOR EACH ROW EXECUTE FUNCTION public.check_brand_email();

-- Display-only badge for other users
CREATE OR REPLACE FUNCTION public.brand_badges(_ids uuid[])
RETURNS TABLE(id uuid, verified boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT user_id, email_check = 'verified_domain' FROM brand_profiles WHERE user_id = ANY(_ids) $$;
GRANT EXECUTE ON FUNCTION public.brand_badges(uuid[]) TO authenticated;