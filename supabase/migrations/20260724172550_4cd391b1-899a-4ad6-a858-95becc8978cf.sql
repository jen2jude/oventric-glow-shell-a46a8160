DROP INDEX IF EXISTS public.wallet_tx_paystack_ref_uidx;
CREATE INDEX IF NOT EXISTS wallet_transactions_paystack_ref_idx
  ON public.wallet_transactions (paystack_ref)
  WHERE paystack_ref IS NOT NULL;