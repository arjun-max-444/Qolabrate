DROP POLICY IF EXISTS social_public_read ON public.creator_social_accounts;
CREATE POLICY social_signed_in_read ON public.creator_social_accounts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.creator_social_accounts FROM anon;