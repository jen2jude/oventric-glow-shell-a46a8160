
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_audience_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_audience_check CHECK (audience IN ('public','circle','followers'));

-- Backfill: rows with circle_id become 'circle'
UPDATE public.posts SET audience = 'circle' WHERE circle_id IS NOT NULL AND audience <> 'circle';

DROP POLICY IF EXISTS posts_select_public ON public.posts;
DROP POLICY IF EXISTS posts_select_members ON public.posts;
DROP POLICY IF EXISTS posts_select_followers ON public.posts;
DROP POLICY IF EXISTS posts_select_own ON public.posts;

CREATE POLICY posts_select_public ON public.posts
  FOR SELECT
  USING (audience = 'public' AND circle_id IS NULL);

CREATE POLICY posts_select_members ON public.posts
  FOR SELECT
  USING (audience = 'circle' AND circle_id IS NOT NULL AND public.is_circle_member(auth.uid(), circle_id));

CREATE POLICY posts_select_followers ON public.posts
  FOR SELECT
  USING (
    audience = 'followers'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.followee_id = posts.author_id
        AND f.follower_id = auth.uid()
    )
  );

CREATE POLICY posts_select_own ON public.posts
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS posts_audience_idx ON public.posts (audience);
