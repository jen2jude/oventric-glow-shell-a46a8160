
-- Extend products table for physical goods + moderation workflow
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS negotiable text,
  ADD COLUMN IF NOT EXISTS delivery text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS social_link text,
  ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}';

-- Constraints
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_kind_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_kind_check CHECK (kind IN ('digital','physical'));
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_status_check CHECK (status IN ('pending','active','rejected'));

-- Tighten public visibility to only active products; owners still see own; admins still see all
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Active products are viewable by everyone"
  ON public.products FOR SELECT
  USING (status = 'active');

CREATE POLICY "Sellers view own products"
  ON public.products FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);
