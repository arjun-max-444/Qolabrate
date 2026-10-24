CREATE OR REPLACE FUNCTION public.choose_signup_role(_role app_role)
 RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cur app_role; em text; prov text;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
IF _role NOT IN ('creator','brand') THEN RAISE EXCEPTION 'Invalid role'; END IF;
SELECT role INTO cur FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('creator','brand') LIMIT 1;
IF cur IS NOT NULL THEN RETURN cur; END IF;
SELECT email, coalesce(raw_app_meta_data->>'provider','email') INTO em, prov FROM auth.users WHERE id = auth.uid();
IF _role = 'brand' AND (NOT public.is_business_email(em) OR prov NOT IN ('email','google','azure')) THEN
  RAISE EXCEPTION 'Brands and agencies require an official business email';
END IF;
IF _role = 'creator' AND prov NOT IN ('email','google') THEN
  RAISE EXCEPTION 'Creators sign up with email and password or Google';
END IF;
INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), _role) ON CONFLICT DO NOTHING;
IF _role = 'brand' THEN
  INSERT INTO public.brands(user_id, name) SELECT id, full_name FROM public.profiles WHERE id = auth.uid() ON CONFLICT (user_id) DO NOTHING;
ELSE
  INSERT INTO public.creators(user_id, name) SELECT id, full_name FROM public.profiles WHERE id = auth.uid() ON CONFLICT (user_id) DO NOTHING;
END IF;
RETURN _role;
END $function$;
REVOKE ALL ON FUNCTION public.choose_signup_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_signup_role(app_role) TO authenticated, service_role;