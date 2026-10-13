CREATE OR REPLACE FUNCTION public.choose_signup_role(_role public.app_role)
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur public.app_role; em text; provider text;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
IF _role NOT IN ('creator','brand') THEN RAISE EXCEPTION 'Invalid role'; END IF;
SELECT role INTO cur FROM public.user_roles WHERE user_id = auth.uid();
-- An account's role is permanent once set: creators stay creators, brands stay brands.
IF cur IS NOT NULL THEN RETURN cur; END IF;
SELECT email, raw_app_meta_data->>'provider' INTO em, provider FROM auth.users WHERE id = auth.uid();
IF _role = 'brand' AND (NOT public.is_business_email(em) OR coalesce(provider,'email') <> 'email') THEN
  RAISE EXCEPTION 'Brands and agencies require an official business email and password';
END IF;
INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), _role) ON CONFLICT (user_id) DO NOTHING;
IF _role = 'brand' THEN
  INSERT INTO public.brands(user_id, name) SELECT id, full_name FROM public.profiles WHERE id = auth.uid() ON CONFLICT (user_id) DO NOTHING;
ELSE
  INSERT INTO public.creators(user_id, name) SELECT id, full_name FROM public.profiles WHERE id = auth.uid() ON CONFLICT (user_id) DO NOTHING;
END IF;
RETURN _role;
END; $$;