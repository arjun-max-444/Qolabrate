CREATE TABLE public.feed_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT ON public.feed_reports TO authenticated;
GRANT ALL ON public.feed_reports TO service_role;
ALTER TABLE public.feed_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Report as own profile" ON public.feed_reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = reporter_id AND p.user_id = auth.uid()));
CREATE POLICY "Read own reports" ON public.feed_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = reporter_id AND p.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS feed_follows_followee_idx ON public.feed_follows(followee_id);
CREATE INDEX IF NOT EXISTS feed_posts_author_created_idx ON public.feed_posts(author_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_feed_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid; who record;
BEGIN
  SELECT user_id INTO target FROM feed_profiles WHERE id = NEW.followee_id;
  IF target IS NULL THEN RETURN NEW; END IF;
  SELECT handle, display_name INTO who FROM feed_profiles WHERE id = NEW.follower_id;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = target AND link = '/p/' || who.handle
                 AND title = 'New follower' AND created_at > now() - interval '1 day') THEN
    INSERT INTO notifications (user_id, title, body, link)
    VALUES (target, 'New follower', who.display_name || ' started following you', '/p/' || who.handle);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_feed_follow() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS feed_follow_notify ON public.feed_follows;
CREATE TRIGGER feed_follow_notify AFTER INSERT ON public.feed_follows FOR EACH ROW EXECUTE FUNCTION public.notify_feed_follow();