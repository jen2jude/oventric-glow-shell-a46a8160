DROP POLICY IF EXISTS "Buyer inserts own contact" ON public.product_contacts;
DROP POLICY IF EXISTS "Buyer reads own contacts" ON public.product_contacts;
DROP POLICY IF EXISTS "Seller reads own contacts" ON public.product_contacts;

CREATE POLICY "Buyer inserts own contact"
  ON public.product_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = buyer_id
  );

CREATE POLICY "Buyer reads own contacts"
  ON public.product_contacts
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = buyer_id
  );

CREATE POLICY "Seller reads own contacts"
  ON public.product_contacts
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = seller_id
  );