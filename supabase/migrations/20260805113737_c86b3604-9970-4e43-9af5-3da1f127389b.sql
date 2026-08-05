ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS product_category_snapshot text;

UPDATE public.orders o
SET product_name_snapshot = COALESCE(o.product_name_snapshot, p.name),
    product_category_snapshot = COALESCE(o.product_category_snapshot, p.category)
FROM public.products p
WHERE p.id = o.product_id;

ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT orders_product_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;