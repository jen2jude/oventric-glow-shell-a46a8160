
-- Payout recipients (saved bank/momo destinations, tied to Paystack transfer recipient codes)
CREATE TABLE IF NOT EXISTS public.payout_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('NGN','GHS')),
  method TEXT NOT NULL CHECK (method IN ('bank','momo')),
  bank_name TEXT,
  bank_code TEXT,
  account_number TEXT,
  account_name TEXT NOT NULL,
  momo_network TEXT,
  phone TEXT,
  paystack_recipient_code TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_recipients TO authenticated;
GRANT ALL ON public.payout_recipients TO service_role;

ALTER TABLE public.payout_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own recipients" ON public.payout_recipients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert own recipients" ON public.payout_recipients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update own recipients" ON public.payout_recipients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can delete own recipients" ON public.payout_recipients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payout_recipients_user ON public.payout_recipients(user_id);

CREATE TRIGGER update_payout_recipients_updated_at
  BEFORE UPDATE ON public.payout_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend payout_requests with Paystack Transfer state + fee tracking
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS paystack_transfer_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.payout_recipients(id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payout_requests_paystack_transfer_code
  ON public.payout_requests(paystack_transfer_code)
  WHERE paystack_transfer_code IS NOT NULL;

-- New RPC: create a live payout (debits wallet available→escrow) with fee/net metadata.
-- Mirrors payout_request_create but records fee + Paystack recipient code + net receiving amount.
CREATE OR REPLACE FUNCTION public.payout_request_create_live(
  _currency TEXT,
  _amount NUMERIC,
  _fee NUMERIC,
  _net NUMERIC,
  _method TEXT,
  _destination JSONB,
  _recipient_id UUID,
  _recipient_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _bal NUMERIC;
  _new_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _currency NOT IN ('NGN','GHS') THEN RAISE EXCEPTION 'live payouts only for NGN/GHS'; END IF;
  IF _method NOT IN ('bank','momo') THEN RAISE EXCEPTION 'invalid method'; END IF;

  SELECT available_balance INTO _bal
    FROM public.wallets
    WHERE user_id = _uid AND currency = _currency
    FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        escrow_balance = escrow_balance + _amount,
        updated_at = now()
    WHERE user_id = _uid AND currency = _currency;

  INSERT INTO public.payout_requests(
    user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, paystack_recipient_code
  )
  VALUES (
    _uid, _currency, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending',
    _fee, _net, _recipient_id, _recipient_code
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _currency, false, 'pending', now());

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.payout_request_create_live(TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,JSONB,UUID,TEXT) TO authenticated;
