CREATE OR REPLACE FUNCTION public.demo_auto_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d feed_profiles;
  replies text[] := ARRAY[
    'Thanks for reaching out! This is a demo account, but I''d love to hear more about your idea.',
    'Hey! Appreciate the message. Demo account here — real creators and brands reply the same way in Messages.',
    'Sounds interesting! Send over a short brief and timeline and let''s talk.',
    'Great to connect! I usually reply within a day. (Demo account)'
  ];
BEGIN
  SELECT * INTO d FROM feed_profiles WHERE id = NEW.recipient_id;
  IF d.is_demo AND NOT EXISTS (SELECT 1 FROM feed_profiles s WHERE s.id = NEW.sender_id AND s.is_demo) THEN
    INSERT INTO feed_messages (sender_id, recipient_id, body, created_at)
    VALUES (NEW.recipient_id, NEW.sender_id, replies[1 + floor(random() * array_length(replies, 1))::int], now() + interval '2 seconds');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feed_messages_demo_reply ON public.feed_messages;
CREATE TRIGGER feed_messages_demo_reply AFTER INSERT ON public.feed_messages FOR EACH ROW EXECUTE FUNCTION public.demo_auto_reply();

CREATE OR REPLACE FUNCTION public.creator_track_record(_user uuid)
RETURNS TABLE(completed bigint, on_time bigint, success_rate integer, streak integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  s integer := 0;
BEGIN
  IF NOT public.has_role(_user, 'creator') THEN RETURN; END IF;
  FOR r IN SELECT (deadline IS NULL OR completed_at::date <= deadline) AS ok FROM collabs
           WHERE creator_id = _user AND status = 'completed' ORDER BY completed_at DESC LOOP
    EXIT WHEN NOT r.ok;
    s := s + 1;
  END LOOP;
  RETURN QUERY
    SELECT count(*), count(*) FILTER (WHERE c.deadline IS NULL OR c.completed_at::date <= c.deadline),
           CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE c.deadline IS NULL OR c.completed_at::date <= c.deadline) / count(*))::int END,
           s
    FROM collabs c WHERE c.creator_id = _user AND c.status = 'completed';
END $$;
REVOKE ALL ON FUNCTION public.creator_track_record(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.creator_track_record(uuid) TO authenticated;