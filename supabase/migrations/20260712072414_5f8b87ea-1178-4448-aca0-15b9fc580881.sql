
-- 1) Multi-type reactions on posts: extend post_likes with a reaction type.
ALTER TABLE public.post_likes
  ADD COLUMN IF NOT EXISTS reaction TEXT NOT NULL DEFAULT 'love';

ALTER TABLE public.post_likes
  DROP CONSTRAINT IF EXISTS post_likes_reaction_check;
ALTER TABLE public.post_likes
  ADD CONSTRAINT post_likes_reaction_check
  CHECK (reaction IN ('love','like','laugh','crown'));

-- 2) Threaded comments: allow a comment to reply to another comment.
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID NULL
  REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx
  ON public.post_comments(parent_id);

-- 3) Reactions on comments.
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'love'
    CHECK (reaction IN ('love','like','laugh','crown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

GRANT SELECT ON public.comment_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_reactions TO authenticated;
GRANT ALL ON public.comment_reactions TO service_role;

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read comment reactions"
  ON public.comment_reactions FOR SELECT
  USING (true);

CREATE POLICY "users manage their own comment reactions"
  ON public.comment_reactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
