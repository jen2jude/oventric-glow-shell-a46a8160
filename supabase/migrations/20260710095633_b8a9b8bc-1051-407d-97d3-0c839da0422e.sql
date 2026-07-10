CREATE TABLE public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  media_path text,
  media_type text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT direct_messages_has_content CHECK (
    (body IS NOT NULL AND length(btrim(body)) > 0) OR media_path IS NOT NULL
  )
);

CREATE INDEX direct_messages_pair_created_idx
  ON public.direct_messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX direct_messages_recipient_created_idx
  ON public.direct_messages (recipient_id, created_at DESC);
CREATE INDEX direct_messages_recipient_unread_idx
  ON public.direct_messages (recipient_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read their messages"
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Sender can create own messages"
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipient can mark read"
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Sender can delete own messages"
  ON public.direct_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages';
  END IF;
END $$;