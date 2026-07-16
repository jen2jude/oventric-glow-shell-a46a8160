
-- Restore data-API grants on public.products lost after security lockdown migration.
-- Public (anon) may read all columns EXCEPT direct contact fields (seller_phone, whatsapp_number, social_link),
-- matching the earlier security fix. Authenticated users retain full access; RLS keeps them scoped.
GRANT SELECT (
  id, seller_id, name, category, description, price_usd, hue, cover_path, file_path,
  external_url, vendor, rating, reviews, promoted, created_at, updated_at,
  original_currency, original_amount, fx_snapshot, kind, status, reject_reason,
  subcategory, condition, brand, location, negotiable, delivery, image_paths
) ON public.products TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
