
ALTER TABLE public.blog_comments ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_blog_comments_hidden ON public.blog_comments (post_id) WHERE is_hidden = false;

-- Allow admins to update blog_comments (to toggle is_hidden)
DROP POLICY IF EXISTS "Admins can moderate blog comments" ON public.blog_comments;
CREATE POLICY "Admins can moderate blog comments"
  ON public.blog_comments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
