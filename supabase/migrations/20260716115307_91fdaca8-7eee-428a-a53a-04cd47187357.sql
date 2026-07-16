
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_email TEXT,
  ADD COLUMN IF NOT EXISTS delivery_whatsapp TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS requires_manual_delivery BOOLEAN NOT NULL DEFAULT FALSE;
