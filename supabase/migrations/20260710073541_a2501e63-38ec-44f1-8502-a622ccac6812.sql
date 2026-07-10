ALTER TABLE public.system_wallets DROP CONSTRAINT IF EXISTS system_wallets_kind_check;
ALTER TABLE public.system_wallets ADD CONSTRAINT system_wallets_kind_check
  CHECK (kind IN ('marketplace','bounty','ads','academy'));

ALTER TABLE public.system_wallet_transactions DROP CONSTRAINT IF EXISTS system_wallet_transactions_kind_check;
ALTER TABLE public.system_wallet_transactions ADD CONSTRAINT system_wallet_transactions_kind_check
  CHECK (kind IN ('marketplace','bounty','ads','academy'));

INSERT INTO public.system_wallets (kind, balance_usd)
  VALUES ('academy', 0) ON CONFLICT (kind) DO NOTHING;

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS display_currency TEXT,
  ADD COLUMN IF NOT EXISTS display_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_usd NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_usd NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;