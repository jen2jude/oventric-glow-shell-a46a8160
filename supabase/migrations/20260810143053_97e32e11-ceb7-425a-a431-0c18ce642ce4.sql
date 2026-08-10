-- 1. Column-level restriction on products contact fields
REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (
  id, seller_id, name, category, description, price_usd, hue, cover_path, file_path,
  external_url, vendor, rating, reviews, promoted, created_at, updated_at,
  original_currency, original_amount, fx_snapshot, kind, status, reject_reason,
  subcategory, condition, brand, location, negotiable, delivery, image_paths,
  requires_manual_delivery
) ON public.products TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- 2. story_views: exclude anonymous/guest sessions
DROP POLICY IF EXISTS story_views_select ON public.story_views;
CREATE POLICY story_views_select ON public.story_views
FOR SELECT TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS story_views_insert_own ON public.story_views;
CREATE POLICY story_views_insert_own ON public.story_views
FOR INSERT TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND viewer_id = auth.uid()
);

-- 3. ad_inquiries: exclude anonymous/guest sessions
DROP POLICY IF EXISTS "own inquiries read" ON public.ad_inquiries;
CREATE POLICY "own inquiries read" ON public.ad_inquiries
FOR SELECT TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "self insert inquiries" ON public.ad_inquiries;
CREATE POLICY "self insert inquiries" ON public.ad_inquiries
FOR INSERT TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND auth.uid() = user_id
);