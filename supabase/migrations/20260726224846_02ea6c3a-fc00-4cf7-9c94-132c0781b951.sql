
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS shared_to_feed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS posts_shared_to_feed_idx
  ON public.posts (created_at DESC)
  WHERE shared_to_feed = true;

DROP POLICY IF EXISTS posts_select_shared_circle ON public.posts;
CREATE POLICY posts_select_shared_circle ON public.posts
  FOR SELECT
  USING (
    audience = 'circle'
    AND circle_id IS NOT NULL
    AND shared_to_feed = true
    AND ((auth.jwt() IS NULL) OR (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE))
  );
