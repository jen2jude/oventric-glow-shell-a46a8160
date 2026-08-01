-- =========================================================
-- 1. Manual (MiniPay) payments
-- =========================================================
CREATE TABLE public.manual_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'minipay',
  purpose TEXT NOT NULL CHECK (purpose IN ('order','course','bounty')),
  target_id UUID,
  target_label TEXT,
  currency TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  reference TEXT NOT NULL UNIQUE,
  proof_path TEXT,
  payer_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX manual_payments_user_idx ON public.manual_payments(user_id, created_at DESC);
CREATE INDEX manual_payments_status_idx ON public.manual_payments(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.manual_payments TO authenticated;
GRANT ALL ON public.manual_payments TO service_role;

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_payments_select_own"
  ON public.manual_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_management_role(auth.uid()));

CREATE POLICY "manual_payments_insert_own"
  ON public.manual_payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "manual_payments_update_own_cancel"
  ON public.manual_payments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "manual_payments_admin_update"
  ON public.manual_payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'finance'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'finance'::app_role));

CREATE TRIGGER manual_payments_updated_at
  BEFORE UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. Flutterwave webhook dedupe
-- =========================================================
CREATE TABLE public.flutterwave_webhook_events (
  signature TEXT NOT NULL PRIMARY KEY,
  event TEXT,
  reference TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.flutterwave_webhook_events TO service_role;

ALTER TABLE public.flutterwave_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

-- =========================================================
-- 3. Gateway settings (single row)
-- =========================================================
CREATE TABLE public.payment_gateway_settings (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  flutterwave_enabled BOOLEAN NOT NULL DEFAULT true,
  paystack_enabled BOOLEAN NOT NULL DEFAULT true,
  minipay_enabled BOOLEAN NOT NULL DEFAULT false,
  minipay_handle TEXT,
  minipay_account_name TEXT,
  minipay_instructions TEXT,
  minipay_currencies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_gateway_settings TO authenticated;
GRANT ALL ON public.payment_gateway_settings TO service_role;

ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gateway_settings_read"
  ON public.payment_gateway_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "gateway_settings_admin_write"
  ON public.payment_gateway_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_gateway_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 4. Provider columns on payout tables
-- =========================================================
ALTER TABLE public.payout_recipients
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS provider_recipient_code TEXT;

UPDATE public.payout_recipients
  SET provider_recipient_code = paystack_recipient_code
  WHERE provider_recipient_code IS NULL;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS provider_recipient_code TEXT,
  ADD COLUMN IF NOT EXISTS provider_transfer_code TEXT;

UPDATE public.payout_requests
  SET provider_recipient_code = COALESCE(provider_recipient_code, paystack_recipient_code),
      provider_transfer_code  = COALESCE(provider_transfer_code, paystack_transfer_code);

CREATE INDEX IF NOT EXISTS payout_requests_provider_transfer_idx
  ON public.payout_requests(provider_transfer_code);

-- =========================================================
-- 5. Payment proof storage policies (bucket already created)
-- =========================================================
CREATE POLICY "payment_proofs_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "payment_proofs_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "payment_proofs_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- 6. Provider-aware live payout creation (any currency)
-- =========================================================
CREATE OR REPLACE FUNCTION public.payout_request_create_live(
  _currency text,
  _amount numeric,
  _fee numeric,
  _net numeric,
  _method text,
  _destination jsonb,
  _recipient_id uuid,
  _recipient_code text,
  _provider text DEFAULT 'paystack'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bal numeric;
  _new_id uuid;
  _cur text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _method NOT IN ('bank','momo') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;
  IF _provider NOT IN ('paystack','flutterwave') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;

  _cur := _currency;

  SELECT available_balance INTO _bal
  FROM public.wallets
  WHERE user_id = _uid AND currency = _cur::public.wallet_currency
  FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
  SET available_balance = available_balance - _amount,
      escrow_balance = escrow_balance + _amount,
      updated_at = now()
  WHERE user_id = _uid AND currency = _cur::public.wallet_currency;

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, paystack_recipient_code,
    provider, provider_recipient_code)
  VALUES (_uid, _cur, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending',
    _fee, _net, _recipient_id,
    CASE WHEN _provider = 'paystack' THEN _recipient_code ELSE NULL END,
    _provider, _recipient_code)
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
  VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur::public.wallet_currency, false, 'pending', now());

  RETURN _new_id;
END;
$function$;