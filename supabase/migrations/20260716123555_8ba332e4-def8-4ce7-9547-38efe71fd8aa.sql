-- Restore Data API permissions for marketplace products while keeping contact columns protected.

GRANT SELECT (
  id,
  seller_id,
  name,
  category,
  subcategory,
  description,
  price_usd,
  original_currency,
  original_amount,
  fx_snapshot,
  hue,
  vendor,
  rating,
  reviews,
  promoted,
  external_url,
  file_path,
  cover_path,
  created_at,
  kind,
  status,
  reject_reason,
  condition,
  brand,
  location,
  negotiable,
  delivery,
  image_paths,
  requires_manual_delivery
) ON public.products TO anon;

GRANT SELECT (
  id,
  seller_id,
  name,
  category,
  subcategory,
  description,
  price_usd,
  original_currency,
  original_amount,
  fx_snapshot,
  hue,
  vendor,
  rating,
  reviews,
  promoted,
  external_url,
  file_path,
  cover_path,
  created_at,
  kind,
  status,
  reject_reason,
  condition,
  brand,
  location,
  negotiable,
  delivery,
  image_paths,
  requires_manual_delivery
) ON public.products TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- Keep sensitive seller contact fields off direct product reads.
REVOKE SELECT (seller_phone, whatsapp_number, social_link) ON public.products FROM anon;
REVOKE SELECT (seller_phone, whatsapp_number, social_link) ON public.products FROM authenticated;

-- The existing secured functions remain the only direct way to read contact details.
GRANT EXECUTE ON FUNCTION public.get_product_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_product_contact(uuid) TO authenticated;