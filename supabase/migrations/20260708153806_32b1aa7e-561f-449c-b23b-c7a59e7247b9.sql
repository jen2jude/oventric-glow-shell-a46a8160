CREATE TYPE public.wallet_currency AS ENUM ('USD', 'NGN', 'GHS');
CREATE TYPE public.wallet_tx_status AS ENUM ('success', 'pending', 'failed');
CREATE TYPE public.wallet_tx_type AS ENUM (
  'Marketplace Purchase',
  'Gig Bounty Escrowed',
  'Ad Injection Charge',
  'Affiliate Cashback Payout',
  'Wallet Top-Up',
  'Payout Withdrawal'
);

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tx_hash text NOT NULL,
  type public.wallet_tx_type NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency public.wallet_currency NOT NULL,
  inflow boolean NOT NULL,
  status public.wallet_tx_status NOT NULL DEFAULT 'pending',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_transactions_user_occurred_idx
  ON public.wallet_transactions (user_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can read own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user can insert own wallet transactions"
  ON public.wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);