
-- Restore products table grants. RLS still governs row access.
-- Authenticated users need SELECT on all columns so seller-owned queries (My Listings)
-- and admin queries work. Anonymous public browsing gets column-level SELECT that
-- excludes PII (seller_phone, whatsapp_number, social_link).

GRANT SELECT (
  id, seller_id, name, category, subcategory, description, price_usd,
  original_currency, original_amount, fx_snapshot, hue, vendor, rating, reviews,
  promoted, external_url, cover_path, image_paths, created_at, updated_at,
  kind, status, condition, brand, location, negotiable, delivery,
  requires_manual_delivery
) ON public.products TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
