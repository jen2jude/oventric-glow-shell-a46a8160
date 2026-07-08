
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  initials text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read comments"
  ON public.post_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "author can insert own comments"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "author can delete own comments"
  ON public.post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE INDEX post_comments_post_id_created_idx
  ON public.post_comments (post_id, created_at ASC);

ALTER TABLE public.post_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
