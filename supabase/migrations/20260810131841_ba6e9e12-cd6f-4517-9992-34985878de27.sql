-- 1. Products: column-level SELECT excluding contact fields
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, seller_id, name, category, description, price_usd, hue, cover_path, file_path, external_url, vendor, rating, reviews, promoted, created_at, updated_at, original_currency, original_amount, fx_snapshot, kind, status, reject_reason, subcategory, condition, brand, location, negotiable, delivery, image_paths, requires_manual_delivery)
  ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;

-- 2. post_shares: restrict reads
DROP POLICY IF EXISTS "Anyone can read share logs" ON public.post_shares;
CREATE POLICY "Share logs visible to sharer, author, admins"
ON public.post_shares FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_shares.post_id AND p.author_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. user_blocks: exclude anonymous sessions
DROP POLICY IF EXISTS "Users manage their own blocks" ON public.user_blocks;
CREATE POLICY "Users manage their own blocks"
ON public.user_blocks FOR ALL TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = blocker_id
)
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND auth.uid() = blocker_id
);