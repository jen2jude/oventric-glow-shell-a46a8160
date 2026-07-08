
-- 1) posts table
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_all_authed" ON public.posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX posts_author_id_idx ON public.posts (author_id);

ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- 2) post_likes table
CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_likes_select_all_authed" ON public.post_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_likes_insert_own" ON public.post_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes_delete_own" ON public.post_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX post_likes_post_idx ON public.post_likes (post_id);

ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;

-- 3) Convert post_comments.post_id from text to uuid FK -> posts.id
-- Table currently has 0 rows so a hard cast is safe.
ALTER TABLE public.post_comments
  ALTER COLUMN post_id TYPE uuid USING (post_id::uuid);

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments (post_id);
