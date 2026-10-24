ALTER TABLE public.feed_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS feed_messages_unread_idx ON public.feed_messages (recipient_id) WHERE read_at IS NULL;
CREATE OR REPLACE FUNCTION public.mark_messages_read(_other uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.feed_messages m SET read_at = now()
  WHERE m.sender_id = _other AND m.read_at IS NULL
    AND m.recipient_id IN (SELECT id FROM public.feed_profiles WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;