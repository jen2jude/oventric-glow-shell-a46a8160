
-- ===== products: strip contact PII from public reads + block anonymous JWTs =====
REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (
  id, seller_id, name, category, description, price_usd, hue, cover_path,
  file_path, external_url, vendor, rating, reviews, promoted,
  created_at, updated_at, original_currency, original_amount, fx_snapshot,
  kind, status, reject_reason, subcategory, condition, brand, location,
  negotiable, delivery, image_paths, requires_manual_delivery
) ON public.products TO anon, authenticated;

DROP POLICY IF EXISTS "Sellers view own products" ON public.products;
CREATE POLICY "Sellers view own products" ON public.products
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = seller_id
  );

DROP POLICY IF EXISTS "Sellers update own products" ON public.products;
CREATE POLICY "Sellers update own products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = seller_id
  )
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = seller_id
  );

DROP POLICY IF EXISTS "Sellers delete own products" ON public.products;
CREATE POLICY "Sellers delete own products" ON public.products
  FOR DELETE TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = seller_id
  );

DROP POLICY IF EXISTS "Sellers insert own products" ON public.products;
CREATE POLICY "Sellers insert own products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = seller_id
  );

DROP POLICY IF EXISTS "Admins manage all products" ON public.products;
CREATE POLICY "Admins manage all products" ON public.products
  FOR ALL TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ===== ad_campaigns: strip advertiser PII + financials from public reads =====
REVOKE SELECT ON public.ad_campaigns FROM anon, authenticated;

GRANT SELECT (
  id, title, advertiser, description, status, tier, header, body,
  media_path, media_url, placements, cta_type, cta_url, cta_label,
  cta_whatsapp, start_at, end_at, countries, cities, priority,
  created_at, updated_at
) ON public.ad_campaigns TO anon, authenticated;

-- Owners and admins still need full-row read; restore full SELECT for those paths.
GRANT SELECT ON public.ad_campaigns TO service_role;

-- Owner and admin policies already exist; add full column read via a separate policy
-- keyed on the owner/admin USING clauses. RLS still gates the rows; column grants
-- apply at the table level, so provide owner/admin surface via a definer function.
CREATE OR REPLACE FUNCTION public.get_my_campaign(_id uuid)
RETURNS SETOF public.ad_campaigns
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.ad_campaigns
  WHERE id = _id
    AND (
      advertiser_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );
$$;
REVOKE ALL ON FUNCTION public.get_my_campaign(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_campaign(uuid) TO authenticated;

-- ===== blog_comments: hide moderated rows from the public =====
DROP POLICY IF EXISTS "blog_comments read" ON public.blog_comments;
CREATE POLICY "blog_comments read" ON public.blog_comments
  FOR SELECT TO public
  USING (
    is_hidden IS NOT TRUE
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ===== profiles: column-level SELECT for anon/authenticated =====
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  user_id, slug, display_name, username, verification_tier, reputation_stars,
  country, kyc_completed_at, profile_completed_at, avatar_path, bio, cover_path,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;
