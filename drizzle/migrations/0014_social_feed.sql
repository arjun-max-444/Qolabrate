CREATE TABLE public.feed_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  handle text NOT NULL UNIQUE,
  display_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('creator','brand')),
  bio text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  demo_no int UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feed_profiles TO authenticated;
GRANT ALL ON public.feed_profiles TO service_role;
ALTER TABLE public.feed_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read feed profiles" ON public.feed_profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  image_key text CHECK (image_key IN ('film','campaign','product')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_posts_created_idx ON public.feed_posts (created_at DESC);
CREATE INDEX feed_posts_author_idx ON public.feed_posts (author_id);
GRANT SELECT, INSERT, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read posts" ON public.feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Write own posts" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = author_id AND p.user_id = auth.uid()));
CREATE POLICY "Delete own posts" ON public.feed_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = author_id AND p.user_id = auth.uid()));

CREATE TABLE public.feed_likes (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.feed_likes TO authenticated;
GRANT ALL ON public.feed_likes TO service_role;
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read likes" ON public.feed_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Like as self" ON public.feed_likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Unlike as self" ON public.feed_likes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE TABLE public.feed_follows (
  follower_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
GRANT SELECT, INSERT, DELETE ON public.feed_follows TO authenticated;
GRANT ALL ON public.feed_follows TO service_role;
ALTER TABLE public.feed_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read follows" ON public.feed_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Follow as self" ON public.feed_follows FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = follower_id AND p.user_id = auth.uid()));
CREATE POLICY "Unfollow as self" ON public.feed_follows FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_profiles p WHERE p.id = follower_id AND p.user_id = auth.uid()));

-- Creates (once) the signed-in member's feed identity from their profile and locked role.
CREATE OR REPLACE FUNCTION public.ensure_feed_profile()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  fid uuid;
  r text;
  base text;
  nm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO fid FROM feed_profiles WHERE user_id = uid;
  IF fid IS NOT NULL THEN RETURN fid; END IF;
  SELECT role::text INTO r FROM user_roles WHERE user_id = uid AND role::text IN ('creator','brand') LIMIT 1;
  IF r IS NULL THEN RAISE EXCEPTION 'Choose an account type first'; END IF;
  SELECT lower(regexp_replace(coalesce(nullif(p.username,''), split_part(p.email,'@',1), 'member'), '[^a-zA-Z0-9_]', '', 'g')),
         coalesce(nullif(case when r='brand' then p.company_name end,''), nullif(p.full_name,''), split_part(p.email,'@',1), 'Member')
    INTO base, nm FROM profiles p WHERE p.id = uid;
  base := coalesce(nullif(base,''), 'member');
  IF EXISTS (SELECT 1 FROM feed_profiles WHERE handle = base) THEN
    base := left(base, 20) || '_' || left(replace(uid::text,'-',''), 5);
  END IF;
  INSERT INTO feed_profiles (user_id, handle, display_name, kind)
  VALUES (uid, base, coalesce(nm,'Member'), r) RETURNING id INTO fid;
  RETURN fid;
END $$;
REVOKE ALL ON FUNCTION public.ensure_feed_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_feed_profile() TO authenticated;

-- 200 demo accounts: 140 creators + 60 brands
INSERT INTO public.feed_profiles (handle, display_name, kind, bio, is_demo, demo_no)
SELECT lower(f) || '_' || lower(l) || i, f || ' ' || l, 'creator',
       (ARRAY['AI filmmaker','Motion designer','Generative artist','UGC creator','3D animator','Brand storyteller','Photographer','Voice & sound creator'])[1 + i % 8] || ' · demo account',
       true, i
FROM generate_series(1,140) i,
LATERAL (SELECT (ARRAY['Aarav','Diya','Rohan','Meera','Kabir','Isha','Arjun','Sana','Vihaan','Anaya','Neel','Tara','Reyansh','Kiara','Aditya','Nisha','Ishaan','Riya','Kunal','Pooja'])[1 + i % 20] AS f,
                (ARRAY['Sharma','Iyer','Kapoor','Reddy','Mehta','Nair','Gupta','Rao','Das','Singh'])[1 + (i / 20) % 10] AS l) n;

INSERT INTO public.feed_profiles (handle, display_name, kind, bio, is_demo, demo_no)
SELECT lower(a) || lower(b) || i, a || ' ' || b, 'brand',
       (ARRAY['Fashion','Beauty','Tech','Food & beverage','Travel','Fitness'])[1 + i % 6] || ' brand · demo account',
       true, 140 + i
FROM generate_series(1,60) i,
LATERAL (SELECT (ARRAY['Nova','Urban','Bloom','Peak','Lumen','Kite','Saffron','Tidal','Orbit','Verde'])[1 + i % 10] AS a,
                (ARRAY['Labs','Studio','Co','Wear','Foods','Travel'])[1 + (i / 10) % 6] AS b) n;

-- 3 posts per demo account
INSERT INTO public.feed_posts (author_id, body, image_key, created_at)
SELECT p.id,
  CASE WHEN p.kind = 'creator' THEN
    (ARRAY['Just wrapped a 30-second AI product film — the lighting pass took longer than the edit.',
           'New reel is up: generative textures mapped onto real footage. Feedback welcome!',
           'Open for brand collaborations this month. Short-form video and motion graphics.',
           'Tip: lock your style frames before you prompt a single shot. Saves days.',
           'Finished a 3D packshot series for a skincare launch. Swipe-worthy results.',
           'Experimenting with AI voiceover for explainer videos — surprisingly natural.',
           'Behind the scenes of my latest campaign: 40 iterations, 1 final frame.',
           'Looking to team up with a sound designer for a music-video project.'])[1 + (p.demo_no * 3 + k) % 8]
  ELSE
    (ARRAY['We are hiring creators for our festive campaign. Apply via Qolabrate!',
           'Looking for AI animators for a 15-second product teaser. Budget ready.',
           'Our new collection drops next week — searching for UGC creators.',
           'Thanks to every creator who pitched last week. Shortlist coming soon.',
           'Need a motion designer for a launch video. DM us your reel.',
           'Campaign brief live: travel stories with a cinematic AI twist.'])[1 + (p.demo_no + k) % 6]
  END,
  CASE WHEN (p.demo_no + k) % 7 = 0 THEN (ARRAY['film','campaign','product'])[1 + (p.demo_no + k) % 3] END,
  now() - make_interval(mins => ((p.demo_no * 37 + k * 211) % 10080))
FROM public.feed_profiles p, generate_series(0,2) k
WHERE p.is_demo;

-- each demo account follows 8 others
INSERT INTO public.feed_follows (follower_id, followee_id)
SELECT a.id, b.id
FROM public.feed_profiles a, generate_series(1,8) k
JOIN public.feed_profiles b ON true
WHERE a.is_demo AND b.is_demo AND b.demo_no = 1 + ((a.demo_no + k * 23) % 200) AND a.id <> b.id
ON CONFLICT DO NOTHING;

-- likes: each post liked by 0–24 demo accounts
INSERT INTO public.feed_likes (post_id, profile_id)
SELECT po.id, pr.id
FROM public.feed_posts po
JOIN public.feed_profiles au ON au.id = po.author_id
CROSS JOIN generate_series(1,24) k
JOIN public.feed_profiles pr ON pr.is_demo AND pr.demo_no = 1 + ((au.demo_no * 13 + k * 31 + extract(minute from po.created_at)::int) % 200)
WHERE k <= (au.demo_no * 7 + extract(minute from po.created_at)::int) % 25
ON CONFLICT DO NOTHING;