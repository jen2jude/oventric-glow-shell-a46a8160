
CREATE TABLE IF NOT EXISTS public.product_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('call','whatsapp')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_contacts_buyer ON public.product_contacts(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_contacts_seller ON public.product_contacts(seller_id, created_at DESC);

GRANT SELECT, INSERT ON public.product_contacts TO authenticated;
GRANT ALL ON public.product_contacts TO service_role;

ALTER TABLE public.product_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer inserts own contact"
  ON public.product_contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyer reads own contacts"
  ON public.product_contacts FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Seller reads own contacts"
  ON public.product_contacts FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);
