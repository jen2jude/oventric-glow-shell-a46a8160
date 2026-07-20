
-- Helper: post visible to current requester
CREATE OR REPLACE FUNCTION public.post_visible_to_me(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND (
        (p.audience = 'public' AND p.circle_id IS NULL)
        OR (auth.uid() IS NOT NULL AND p.author_id = auth.uid())
        OR (p.audience = 'circle' AND p.circle_id IS NOT NULL AND public.is_circle_member(auth.uid(), p.circle_id))
        OR (p.audience = 'followers' AND auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.followee_id = p.author_id AND f.follower_id = auth.uid()
        ))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.post_visible_to_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_visible_to_me(uuid) TO anon, authenticated, service_role;

-- post_comments: replace permissive SELECT policies
DROP POLICY IF EXISTS "public can read comments" ON public.post_comments;
DROP POLICY IF EXISTS "authenticated can read comments" ON public.post_comments;

CREATE POLICY "anon can read comments on visible posts"
ON public.post_comments FOR SELECT TO anon
USING (public.post_visible_to_me(post_id));

CREATE POLICY "auth can read comments on visible posts"
ON public.post_comments FOR SELECT TO authenticated
USING (public.post_visible_to_me(post_id));

-- post_likes: replace permissive SELECT policy
DROP POLICY IF EXISTS "post_likes readable when parent post is visible" ON public.post_likes;

CREATE POLICY "post_likes readable when parent post is visible"
ON public.post_likes FOR SELECT TO anon, authenticated
USING (public.post_visible_to_me(post_id));

-- comment_reactions: replace public policy
DROP POLICY IF EXISTS "public can read comment reactions" ON public.comment_reactions;

CREATE POLICY "reactions readable when parent post is visible"
ON public.comment_reactions FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.post_comments c
  WHERE c.id = comment_reactions.comment_id
    AND public.post_visible_to_me(c.post_id)
));

-- suppressed_emails: restrict roles from public to service_role
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;

CREATE POLICY "Service role can read suppressed emails"
ON public.suppressed_emails FOR SELECT TO service_role
USING (true);

CREATE POLICY "Service role can insert suppressed emails"
ON public.suppressed_emails FOR INSERT TO service_role
WITH CHECK (true);
