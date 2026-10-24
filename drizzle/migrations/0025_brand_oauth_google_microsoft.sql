-- Brands may sign in with email/password, Google or Microsoft, but always with an official business email.
-- Social sign-ups get their account type after sign-in (choose_signup_role), since OAuth carries no signup metadata.
CREATE OR REPLACE FUNCTION public.initialize_account()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE r public.app_role; prov text; BEGIN
prov := coalesce(NEW.raw_app_meta_data->>'provider','email');
INSERT INTO public.profiles(id,email,full_name) VALUES(NEW.id,coalesce(NEW.email,''),coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',''));
IF prov <> 'email' THEN RETURN NEW; END IF;
r := CASE WHEN NEW.raw_user_meta_data->>'signup_role'='brand' THEN 'brand'::public.app_role ELSE 'creator'::public.app_role END;
IF r='brand' AND NOT public.is_business_email(NEW.email) THEN RAISE EXCEPTION 'Brands and agencies require an official business email'; END IF;
INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,r);
IF r='brand' THEN INSERT INTO public.brands(user_id,name) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name','')) ON CONFLICT(user_id) DO NOTHING;
ELSE INSERT INTO public.creators(user_id,name) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name','')) ON CONFLICT(user_id) DO NOTHING; END IF;
RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.choose_signup_role(_role app_role)
 RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cur app_role; em text; prov text;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
IF _role NOT IN ('creator','brand') THEN RAISE EXCEPTION 'Invalid role'; END IF;
SELECT role INTO cur FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('creator','brand') LIMIT 1;
-- An account's type is permanent once set: creators stay creators, brands stay brands.
IF cur IS NOT NULL THEN RETURN cur; END IF;
SELECT email, coalesce(raw_app_meta_data->>'provider','email') INTO em, prov FROM auth.users WHERE id = auth.uid();
IF _role = 'brand' AND (NOT public.is_business_email(em) OR prov NOT IN ('email','google','azure')) THEN
  RAISE EXCEPTION 'Brands and agencies require an official business email';
END IF;
-- Google and Microsoft sign-in are for brands only.
IF _role = 'creator' AND prov <> 'email' THEN
  RAISE EXCEPTION 'Creators sign up with email and password';
END IF;
INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), _role) ON CONFLICT DO NOTHING;
IF _role = 'brand' THEN
  INSERT INTO public.brands(user_id, name) SELECT id, full_name FROM public.profiles WHERE id = auth.uid() ON CONFLICT (user_id) DO NOTHING;
ELSE
  INSERT INTO public.creators(user_id, name) SELECT id, full_name FROM public.profiles WHERE id = auth.uid() ON CONFLICT (user_id) DO NOTHING;
END IF;
RETURN _role;
END $function$;