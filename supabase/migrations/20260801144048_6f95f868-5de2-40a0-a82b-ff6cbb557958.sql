ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS direct_messages_order_id_idx ON public.direct_messages (order_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS prerelease_notified_at timestamptz NULL;