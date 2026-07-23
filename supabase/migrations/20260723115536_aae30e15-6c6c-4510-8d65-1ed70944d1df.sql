
DROP POLICY IF EXISTS "Active products viewable by authenticated" ON public.products;
CREATE POLICY "Active products are viewable by everyone"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (status = 'active');
GRANT SELECT ON public.products TO anon;
