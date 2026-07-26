
CREATE OR REPLACE FUNCTION public.wallet_debit_currency(_user_id uuid, _amount numeric, _currency text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _bal NUMERIC; _cur public.wallet_currency;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  _cur := _currency::public.wallet_currency;
  SELECT available_balance INTO _bal FROM public.wallets
    WHERE user_id = _user_id AND currency = _cur FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN RETURN false; END IF;
  UPDATE public.wallets SET available_balance = available_balance - _amount, updated_at = now()
    WHERE user_id = _user_id AND currency = _cur;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.wallet_credit_currency(_user_id uuid, _amount numeric, _currency text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _cur public.wallet_currency;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  _cur := _currency::public.wallet_currency;
  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (_user_id, _cur, _amount)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET available_balance = public.wallets.available_balance + EXCLUDED.available_balance,
        updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_wallet(_user_id uuid, _currency text, _which text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _w record; _cur public.wallet_currency;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  IF _which NOT IN ('available','escrow','cashback','bounty','all') THEN RAISE EXCEPTION 'invalid target'; END IF;
  _cur := _currency::public.wallet_currency;
  INSERT INTO public.wallets (user_id, currency) VALUES (_user_id, _cur)
    ON CONFLICT (user_id, currency) DO NOTHING;
  SELECT * INTO _w FROM public.wallets
    WHERE user_id = _user_id AND currency = _cur FOR UPDATE;
  UPDATE public.wallets SET
    available_balance    = CASE WHEN _which IN ('available','all') THEN 0 ELSE available_balance END,
    escrow_balance       = CASE WHEN _which IN ('escrow','all')    THEN 0 ELSE escrow_balance END,
    accumulated_cashback = CASE WHEN _which IN ('cashback','all')  THEN 0 ELSE accumulated_cashback END,
    bounty_balance       = CASE WHEN _which IN ('bounty','all')    THEN 0 ELSE bounty_balance END,
    updated_at = now()
    WHERE user_id = _user_id AND currency = _cur;
  INSERT INTO public.audit_logs (actor_id, action, target_id, meta)
    VALUES (auth.uid(), 'wallet.reset', _user_id,
      jsonb_build_object('currency', _currency, 'which', _which,
        'previous', jsonb_build_object(
          'available', _w.available_balance, 'escrow', _w.escrow_balance,
          'cashback', _w.accumulated_cashback, 'bounty', COALESCE(_w.bounty_balance, 0))));
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_request_create_live(_currency text, _amount numeric, _fee numeric, _net numeric, _method text, _destination jsonb, _recipient_id uuid, _recipient_code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid(); _bal NUMERIC; _new_id UUID; _cur public.wallet_currency;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _currency NOT IN ('NGN','GHS') THEN RAISE EXCEPTION 'live payouts only for NGN/GHS'; END IF;
  IF _method NOT IN ('bank','momo') THEN RAISE EXCEPTION 'invalid method'; END IF;
  _cur := _currency::public.wallet_currency;
  SELECT available_balance INTO _bal FROM public.wallets
    WHERE user_id = _uid AND currency = _cur FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        escrow_balance = escrow_balance + _amount,
        updated_at = now()
    WHERE user_id = _uid AND currency = _cur;
  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, paystack_recipient_code)
  VALUES (_uid, _cur, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending',
    _fee, _net, _recipient_id, _recipient_code)
  RETURNING id INTO _new_id;
  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur, false, 'pending', now());
  RETURN _new_id;
END;
$function$;
