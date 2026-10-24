ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE public.feed_profiles ADD COLUMN IF NOT EXISTS avatar_path text;

CREATE POLICY "Members view feed media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed-media');
CREATE POLICY "Members upload own feed media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Members delete own feed media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.set_feed_avatar(_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _path IS NOT NULL AND split_part(_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'Invalid path'; END IF;
  UPDATE feed_profiles SET avatar_path = _path WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_feed_avatar(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_feed_avatar(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_feed_image_path() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.image_path IS NOT NULL AND split_part(NEW.image_path, '/', 1) <> coalesce(auth.uid()::text, '') THEN
    RAISE EXCEPTION 'Invalid image';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER feed_posts_image_path BEFORE INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.check_feed_image_path();