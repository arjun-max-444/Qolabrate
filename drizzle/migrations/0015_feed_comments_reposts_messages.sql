CREATE TABLE public.feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_comments_post_idx ON public.feed_comments (post_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.feed_comments TO authenticated;
GRANT ALL ON public.feed_comments TO service_role;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read comments" ON public.feed_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comment as self" ON public.feed_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = author_id AND p.user_id = auth.uid()));
CREATE POLICY "Delete own comments" ON public.feed_comments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = author_id AND p.user_id = auth.uid()));

CREATE TABLE public.feed_reposts (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.feed_reposts TO authenticated;
GRANT ALL ON public.feed_reposts TO service_role;
ALTER TABLE public.feed_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read reposts" ON public.feed_reposts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Repost as self" ON public.feed_reposts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Undo own repost" ON public.feed_reposts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE TABLE public.feed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX feed_messages_pair_idx ON public.feed_messages (sender_id, recipient_id, created_at);
CREATE INDEX feed_messages_recipient_idx ON public.feed_messages (recipient_id, created_at);
GRANT SELECT, INSERT ON public.feed_messages TO authenticated;
GRANT ALL ON public.feed_messages TO service_role;
ALTER TABLE public.feed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own conversations" ON public.feed_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.user_id = auth.uid() AND p.id IN (sender_id, recipient_id)));
CREATE POLICY "Send as self" ON public.feed_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = sender_id AND p.user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_messages;

-- demo comments: about a third of demo posts get one reply from another demo account
INSERT INTO public.feed_comments (post_id, author_id, body, created_at)
SELECT po.id, pr.id,
  (ARRAY['Love this — the lighting is spot on!','Would love to collaborate on something like this.','How long did this take you?','Great insight, saving this.','This is exactly what our brand needs.','Congrats on the launch!'])[1 + (au.demo_no + k) % 6],
  po.created_at + interval '20 minutes'
FROM public.feed_posts po
JOIN public.feed_profiles au ON au.id = po.author_id AND au.is_demo
CROSS JOIN generate_series(1,2) k
JOIN public.feed_profiles pr ON pr.is_demo AND pr.demo_no = 1 + ((au.demo_no * 13 + k * 31) % 200)
WHERE (au.demo_no + k + extract(minute from po.created_at)::int) % 3 = 0 AND pr.id <> au.id;

-- demo reposts
INSERT INTO public.feed_reposts (post_id, profile_id)
SELECT po.id, pr.id
FROM public.feed_posts po
JOIN public.feed_profiles au ON au.id = po.author_id AND au.is_demo
CROSS JOIN generate_series(1,6) k
JOIN public.feed_profiles pr ON pr.is_demo AND pr.demo_no = 1 + ((au.demo_no * 7 + k * 41) % 200)
WHERE k <= (au.demo_no + extract(minute from po.created_at)::int) % 7 AND pr.id <> au.id
ON CONFLICT DO NOTHING;