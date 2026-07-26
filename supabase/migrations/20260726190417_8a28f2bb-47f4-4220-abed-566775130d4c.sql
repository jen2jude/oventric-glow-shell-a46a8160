
-- 1. follows: restrict SELECT to participant
DROP POLICY IF EXISTS follows_read_all ON public.follows;
CREATE POLICY follows_read_participant ON public.follows
  FOR SELECT TO authenticated
  USING (
    (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
    AND (auth.uid() = follower_id OR auth.uid() = followee_id)
  );

-- 2. posts: exclude anonymous JWT users from write/delete-own and public read
DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts
  FOR DELETE TO authenticated
  USING (
    (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
    AND auth.uid() = author_id
  );

DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own ON public.posts
  FOR UPDATE TO authenticated
  USING (
    (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
    AND auth.uid() = author_id
  )
  WITH CHECK (
    (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
    AND auth.uid() = author_id
  );

DROP POLICY IF EXISTS posts_select_public ON public.posts;
CREATE POLICY posts_select_public ON public.posts
  FOR SELECT TO anon, authenticated
  USING (
    audience = 'public'
    AND circle_id IS NULL
    AND (
      auth.jwt() IS NULL
      OR (((auth.jwt() ->> 'is_anonymous')::boolean) IS NOT TRUE)
    )
  );

-- 3. email queue helpers: pin search_path
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pgmq, public;
ALTER FUNCTION public.delete_email(text, bigint)               SET search_path = pgmq, public;
ALTER FUNCTION public.enqueue_email(text, jsonb)               SET search_path = pgmq, public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   SET search_path = pgmq, public;
