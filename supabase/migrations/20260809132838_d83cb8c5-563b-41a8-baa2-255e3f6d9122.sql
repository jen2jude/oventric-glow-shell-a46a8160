CREATE TABLE public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('basic','standard','pro')),
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  features text[] NOT NULL DEFAULT '{}',
  price_usd numeric NOT NULL DEFAULT 0,
  original_currency text NOT NULL DEFAULT 'USD',
  original_amount numeric NOT NULL DEFAULT 0,
  delivery_days integer,
  revisions integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, tier)
);

GRANT SELECT ON public.service_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_packages TO authenticated;
GRANT ALL ON public.service_packages TO service_role;

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view packages of visible services"
ON public.service_packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = service_packages.product_id
      AND (p.status = 'active' OR p.seller_id = auth.uid())
  )
);

CREATE POLICY "Sellers manage their own service packages"
ON public.service_packages FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = service_packages.product_id AND p.seller_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = service_packages.product_id AND p.seller_id = auth.uid())
);

CREATE TRIGGER update_service_packages_updated_at
BEFORE UPDATE ON public.service_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_service_packages_product ON public.service_packages(product_id);

ALTER TABLE public.orders
  ADD COLUMN service_package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  ADD COLUMN service_package_snapshot jsonb,
  ADD COLUMN service_brief jsonb;