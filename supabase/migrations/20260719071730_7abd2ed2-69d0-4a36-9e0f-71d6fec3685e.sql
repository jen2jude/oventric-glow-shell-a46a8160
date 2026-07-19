
-- 1. Tighten profiles SELECT policies: block anonymous JWTs and soft-deleted rows.
-- Column-level grants already limit which columns authenticated/anon can read.
DROP POLICY IF EXISTS "authenticated can read public profile columns" ON public.profiles;
DROP POLICY IF EXISTS "anon can read public profile columns" ON public.profiles;

CREATE POLICY "anon can read public profile columns"
ON public.profiles FOR SELECT TO anon
USING (deleted_at IS NULL);

CREATE POLICY "authenticated can read public profile columns"
ON public.profiles FOR SELECT TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND deleted_at IS NULL
);

-- 2. Consolidate post_likes SELECT policies into one visibility-scoped policy.
DROP POLICY IF EXISTS "public can read likes" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_select_all_authed" ON public.post_likes;

CREATE POLICY "post_likes readable when parent post is visible"
ON public.post_likes FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id)
);

-- 3. Block anonymous JWTs on system_wallet_transactions admin policy.
DROP POLICY IF EXISTS "Admins can view system wallet tx" ON public.system_wallet_transactions;

CREATE POLICY "Admins can view system wallet tx"
ON public.system_wallet_transactions FOR SELECT TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
