
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','NGN','GHS')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('bank','momo','wire')),
  destination JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid','cancelled')),
  admin_note TEXT,
  reject_reason TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payout_requests_user_id_idx ON public.payout_requests(user_id);
CREATE INDEX payout_requests_status_idx ON public.payout_requests(status);
CREATE INDEX payout_requests_created_at_idx ON public.payout_requests(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own payouts" ON public.payout_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "users create own payouts" ON public.payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users cancel own pending" ON public.payout_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','cancelled'));

CREATE POLICY "admins update payouts" ON public.payout_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER payout_requests_set_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic create: debit wallet then insert request
CREATE OR REPLACE FUNCTION public.payout_request_create(
  _currency TEXT,
  _amount NUMERIC,
  _method TEXT,
  _destination JSONB
) RETURNS UUID
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
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  IF _method NOT IN ('bank','momo','wire') THEN RAISE EXCEPTION 'invalid method'; END IF;

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

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status)
    VALUES (_uid, _currency, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending')
    RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _currency, false, 'pending', now());

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.payout_request_create(TEXT,NUMERIC,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payout_request_create(TEXT,NUMERIC,TEXT,JSONB) TO authenticated;

-- Reject helper (admin only): refund escrow → available and mark rejected
CREATE OR REPLACE FUNCTION public.payout_request_reject(
  _id UUID,
  _reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.payout_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _row FROM public.payout_requests WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'cannot reject in status %', _row.status;
  END IF;

  UPDATE public.wallets
    SET escrow_balance = GREATEST(escrow_balance - _row.amount, 0),
        available_balance = available_balance + _row.amount,
        updated_at = now()
    WHERE user_id = _row.user_id AND currency = _row.currency;

  UPDATE public.payout_requests
    SET status = 'rejected',
        reject_reason = _reason,
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = _id;

  UPDATE public.wallet_transactions
    SET status = 'failed'
    WHERE user_id = _row.user_id
      AND type = 'Payout Withdrawal'
      AND tx_hash = 'PYT-'||substr(_id::text,1,8);
END;
$$;

REVOKE ALL ON FUNCTION public.payout_request_reject(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payout_request_reject(UUID,TEXT) TO authenticated;

-- Mark paid helper: escrow → burned (already debited), request paid
CREATE OR REPLACE FUNCTION public.payout_request_mark_paid(
  _id UUID,
  _note TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.payout_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _row FROM public.payout_requests WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'cannot mark paid in status %', _row.status;
  END IF;

  UPDATE public.wallets
    SET escrow_balance = GREATEST(escrow_balance - _row.amount, 0),
        updated_at = now()
    WHERE user_id = _row.user_id AND currency = _row.currency;

  UPDATE public.payout_requests
    SET status = 'paid',
        admin_note = _note,
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = _id;

  UPDATE public.wallet_transactions
    SET status = 'success'
    WHERE user_id = _row.user_id
      AND type = 'Payout Withdrawal'
      AND tx_hash = 'PYT-'||substr(_id::text,1,8);
END;
$$;

REVOKE ALL ON FUNCTION public.payout_request_mark_paid(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payout_request_mark_paid(UUID,TEXT) TO authenticated;
