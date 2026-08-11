-- Products: column-scoped read access (exclude seller contact columns)
REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (
  id, seller_id, name, category, description, price_usd, hue, cover_path,
  file_path, external_url, vendor, rating, reviews, promoted, created_at,
  updated_at, original_currency, original_amount, fx_snapshot, kind, status,
  reject_reason, subcategory, condition, brand, location, negotiable,
  delivery, image_paths, requires_manual_delivery
) ON public.products TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- Stories: exclude anonymous (guest) sessions
DROP POLICY IF EXISTS stories_select_live ON public.stories;
CREATE POLICY stories_select_live ON public.stories
FOR SELECT TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND expires_at > now()
);

DROP POLICY IF EXISTS stories_delete_own ON public.stories;
CREATE POLICY stories_delete_own ON public.stories
FOR DELETE TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND user_id = auth.uid()
);