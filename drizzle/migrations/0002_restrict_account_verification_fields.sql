REVOKE EXECUTE ON FUNCTION public.initialize_account() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE(full_name,avatar_path) ON public.profiles TO authenticated;
REVOKE UPDATE ON public.creator_profiles FROM authenticated;
GRANT UPDATE(specialization,bio,location,skills,ai_tools,social_links,profile_completion,details) ON public.creator_profiles TO authenticated;