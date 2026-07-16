
ALTER TABLE public.marketplace_categories
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.marketplace_categories(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_categories DROP CONSTRAINT IF EXISTS marketplace_categories_kind_check;
ALTER TABLE public.marketplace_categories ADD CONSTRAINT marketplace_categories_kind_check CHECK (kind IN ('digital','physical'));

ALTER TABLE public.marketplace_categories DROP CONSTRAINT IF EXISTS marketplace_categories_slug_parent_key;
ALTER TABLE public.marketplace_categories DROP CONSTRAINT IF EXISTS marketplace_categories_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_categories_slug_parent_uniq
  ON public.marketplace_categories (kind, slug, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.marketplace_categories TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read enabled categories" ON public.marketplace_categories;
CREATE POLICY "Public can read enabled categories"
  ON public.marketplace_categories FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

-- Mark existing rows as digital (already the default) explicitly
UPDATE public.marketplace_categories SET kind = 'digital' WHERE kind IS NULL OR kind = '';

-- Seed physical parents
INSERT INTO public.marketplace_categories (slug, name, description, sort_order, enabled, kind)
VALUES
  ('electronics','Electronics','Phones, laptops, gadgets',10,true,'physical'),
  ('fashion','Fashion','Clothing, shoes, accessories',20,true,'physical'),
  ('home','Home & Living','Furniture, appliances, decor',30,true,'physical'),
  ('beauty','Beauty & Health','Skincare, makeup, wellness',40,true,'physical'),
  ('vehicles','Vehicles','Cars, bikes, parts',50,true,'physical'),
  ('sports','Sports & Outdoors','Fitness, outdoor, team sports',60,true,'physical'),
  ('other','Other','Everything else',90,true,'physical')
ON CONFLICT DO NOTHING;

-- Seed subcategories for physical parents
WITH parents AS (
  SELECT id, slug FROM public.marketplace_categories WHERE kind='physical' AND parent_id IS NULL
)
INSERT INTO public.marketplace_categories (slug, name, sort_order, enabled, kind, parent_id)
SELECT sub.slug, sub.name, sub.sort_order, true, 'physical', p.id
FROM parents p
JOIN (VALUES
  ('electronics','phones','Phones',10),
  ('electronics','laptops','Laptops',20),
  ('electronics','accessories','Accessories',30),
  ('electronics','audio','Audio',40),
  ('electronics','cameras','Cameras',50),
  ('fashion','men','Men',10),
  ('fashion','women','Women',20),
  ('fashion','kids','Kids',30),
  ('fashion','shoes','Shoes',40),
  ('fashion','watches','Watches',50),
  ('home','furniture','Furniture',10),
  ('home','appliances','Appliances',20),
  ('home','decor','Decor',30),
  ('home','kitchen','Kitchen',40),
  ('beauty','skincare','Skincare',10),
  ('beauty','makeup','Makeup',20),
  ('beauty','wellness','Wellness',30),
  ('beauty','fragrance','Fragrance',40),
  ('vehicles','cars','Cars',10),
  ('vehicles','bikes','Bikes',20),
  ('vehicles','parts','Parts',30),
  ('vehicles','accessories','Accessories',40),
  ('sports','fitness','Fitness',10),
  ('sports','outdoor','Outdoor',20),
  ('sports','team-sports','Team Sports',30)
) AS sub(parent_slug, slug, name, sort_order) ON sub.parent_slug = p.slug
ON CONFLICT DO NOTHING;
