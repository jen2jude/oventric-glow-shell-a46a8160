DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='products'
    AND column_name NOT IN ('seller_phone','whatsapp_number','social_link');

  REVOKE SELECT ON public.products FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon, authenticated', cols);
END $$;

-- service_packages: block anonymous (is_anonymous) sessions from managing packages
DROP POLICY IF EXISTS "Anyone can view packages of visible services" ON public.service_packages;
CREATE POLICY "Anyone can view packages of visible services"
ON public.service_packages FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = service_packages.product_id AND (p.status = 'active' OR p.seller_id = auth.uid())));

DROP POLICY IF EXISTS "Sellers manage their own service packages" ON public.service_packages;
CREATE POLICY "Sellers manage their own service packages"
ON public.service_packages FOR ALL TO authenticated
USING (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = service_packages.product_id AND p.seller_id = auth.uid()))
WITH CHECK (((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = service_packages.product_id AND p.seller_id = auth.uid()));