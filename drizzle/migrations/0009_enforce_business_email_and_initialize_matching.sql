CREATE OR REPLACE FUNCTION public.is_business_email(_email text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT lower(trim(coalesce(_email,''))) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND split_part(lower(trim(coalesce(_email,''))), '@', 2) <> ALL(ARRAY['gmail.com','googlemail.com','yahoo.com','yahoo.in','yahoo.co.in','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','aol.com','proton.me','protonmail.com','zoho.com','rediffmail.com','gmx.com','mail.com','yandex.com','yandex.ru','ymail.com','hotmail.co.uk','outlook.in','qq.com','163.com','126.com','tuta.com','tutanota.com','pm.me','fastmail.com','hey.com','mailinator.com','guerrillamail.com','tempmail.com','10minutemail.com']); $$;
CREATE OR REPLACE FUNCTION public.initialize_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.app_role; BEGIN
r := CASE WHEN NEW.raw_user_meta_data->>'signup_role'='brand' THEN 'brand'::public.app_role ELSE 'creator'::public.app_role END;
IF r='brand' AND (NOT public.is_business_email(NEW.email) OR coalesce(NEW.raw_app_meta_data->>'provider','email') <> 'email') THEN RAISE EXCEPTION 'Brands and agencies require an official business email and password'; END IF;
INSERT INTO public.profiles(id,email,full_name) VALUES(NEW.id,coalesce(NEW.email,''),coalesce(NEW.raw_user_meta_data->>'full_name',''));
INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,r);
IF r='brand' THEN INSERT INTO public.brands(user_id,name) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name','')) ON CONFLICT(user_id) DO NOTHING;
ELSE INSERT INTO public.creators(user_id,name) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name','')) ON CONFLICT(user_id) DO NOTHING; END IF;
RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.choose_signup_role(_role public.app_role) RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cur public.app_role; created timestamptz; em text; provider text; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
IF _role NOT IN ('creator','brand') THEN RAISE EXCEPTION 'Invalid role'; END IF;
SELECT role INTO cur FROM public.user_roles WHERE user_id=auth.uid(); IF cur='admin' THEN RETURN cur; END IF;
SELECT created_at,email,raw_app_meta_data->>'provider' INTO created,em,provider FROM auth.users WHERE id=auth.uid();
IF created < now()-interval '24 hours' THEN RETURN cur; END IF;
IF _role='brand' AND (NOT public.is_business_email(em) OR coalesce(provider,'email') <> 'email') THEN RAISE EXCEPTION 'Brands and agencies require an official business email and password'; END IF;
INSERT INTO public.user_roles(user_id,role) VALUES(auth.uid(),_role) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
IF _role='brand' THEN INSERT INTO public.brands(user_id,name) SELECT id,full_name FROM public.profiles WHERE id=auth.uid() ON CONFLICT(user_id) DO NOTHING;
ELSE INSERT INTO public.creators(user_id,name) SELECT id,full_name FROM public.profiles WHERE id=auth.uid() ON CONFLICT(user_id) DO NOTHING; END IF;
RETURN _role; END; $$;
INSERT INTO public.creators(user_id,name) SELECT p.id,p.full_name FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role='creator' ON CONFLICT(user_id) DO NOTHING;
INSERT INTO public.brands(user_id,name) SELECT p.id,p.full_name FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role='brand' ON CONFLICT(user_id) DO NOTHING;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;