
-- Tighten posts RLS policies to target 'authenticated' role where auth is required.
-- Keep posts_select_public for anonymous public feed reads (intentional).
DROP POLICY IF EXISTS posts_select_own ON public.posts;
DROP POLICY IF EXISTS posts_select_members ON public.posts;
DROP POLICY IF EXISTS posts_select_followers ON public.posts;

CREATE POLICY posts_select_own ON public.posts
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = author_id
  );

CREATE POLICY posts_select_members ON public.posts
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND audience = 'circle'
    AND circle_id IS NOT NULL
    AND public.is_circle_member(auth.uid(), circle_id)
  );

CREATE POLICY posts_select_followers ON public.posts
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND audience = 'followers'
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.followee_id = posts.author_id
        AND f.follower_id = auth.uid()
    )
  );

-- Restrict profiles/products/ad_campaigns broad SELECT policies to block
-- anonymous (is_anonymous) JWTs and drop the 'public' role where it wasn't
-- already restricted. Column-level GRANTs remain the primary defense for
-- sensitive fields (phone, address, DOB, KYC paths, seller/advertiser
-- contact) — those columns are NOT granted to anon or authenticated, so
-- PostgREST cannot return them regardless of RLS.
DROP POLICY IF EXISTS "anon can read public profile columns" ON public.profiles;
CREATE POLICY "anon can read public profile columns" ON public.profiles
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Anyone can read active campaigns" ON public.ad_campaigns;
CREATE POLICY "Anyone can read active campaigns" ON public.ad_campaigns
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND (start_at IS NULL OR start_at <= now())
    AND (end_at IS NULL OR end_at >= now())
  );

DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;
CREATE POLICY "Active products are viewable by everyone" ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'active');
