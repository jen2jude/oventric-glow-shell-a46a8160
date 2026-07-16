
-- 1. Restrict sensitive product columns from anon and authenticated at column level
REVOKE SELECT ON public.products FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id, seller_id, name, category, description, price_usd, hue, cover_path, file_path,
  external_url, vendor, rating, reviews, promoted, created_at, updated_at,
  original_currency, original_amount, fx_snapshot, kind, status, reject_reason,
  subcategory, condition, brand, negotiable, delivery, social_link, image_paths
) ON public.products TO anon, authenticated;

-- Keep write privileges for authenticated (RLS still enforces ownership)
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- 2. Server-side accessor for sensitive contact fields (authenticated only)
CREATE OR REPLACE FUNCTION public.get_product_contact(_product_id uuid)
RETURNS TABLE (seller_phone text, whatsapp_number text, location text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.seller_phone, p.whatsapp_number, p.location
  FROM public.products p
  WHERE p.id = _product_id
    AND auth.uid() IS NOT NULL
    AND (
      p.status = 'active'
      OR p.seller_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_product_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_contact(uuid) TO authenticated;

-- Seller edit helper: full contact fields for own product
CREATE OR REPLACE FUNCTION public.get_my_product_contact(_product_id uuid)
RETURNS TABLE (seller_phone text, whatsapp_number text, location text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.seller_phone, p.whatsapp_number, p.location
  FROM public.products p
  WHERE p.id = _product_id
    AND (p.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
$$;

REVOKE ALL ON FUNCTION public.get_my_product_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_product_contact(uuid) TO authenticated;

-- 3. Storage policies: reject anonymous sign-in sessions
-- auth.jwt() is NULL for truly unauthenticated requests; is_anonymous claim
-- is TRUE only for anon-signed-in users. IS NOT TRUE lets NULL pass through
-- (needed for the public blog-covers read).
DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS avatars_owner_read ON storage.objects;
CREATE POLICY avatars_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS covers_owner_delete ON storage.objects;
CREATE POLICY covers_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS covers_owner_read ON storage.objects;
CREATE POLICY covers_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS covers_owner_update ON storage.objects;
CREATE POLICY covers_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "blog-covers admin delete" ON storage.objects;
CREATE POLICY "blog-covers admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "blog-covers admin update" ON storage.objects;
CREATE POLICY "blog-covers admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "blog-covers public read" ON storage.objects;
CREATE POLICY "blog-covers public read" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'blog-covers'
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );
