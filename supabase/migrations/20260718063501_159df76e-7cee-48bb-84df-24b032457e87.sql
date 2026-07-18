
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_status TEXT NOT NULL DEFAULT 'released',
  ADD COLUMN IF NOT EXISTS seller_share_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_escrow_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_escrow_status_check
  CHECK (escrow_status IN ('held','released','refunded'));
