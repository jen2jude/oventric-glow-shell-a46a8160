
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paystack_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_paystack_ref_uidx ON public.orders(paystack_ref) WHERE paystack_ref IS NOT NULL;

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS paystack_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_paystack_ref_uidx ON public.wallet_transactions(paystack_ref) WHERE paystack_ref IS NOT NULL;
