CREATE OR REPLACE FUNCTION public.payout_request_create(_currency text, _amount numeric, _method text, _destination jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _bal NUMERIC;
  _new_id UUID;
  _cur public.wallet_currency;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  IF _method NOT IN ('bank','momo','wire') THEN RAISE EXCEPTION 'invalid method'; END IF;

  _cur := _currency::public.wallet_currency;

  SELECT available_balance INTO _bal
    FROM public.wallets
    WHERE user_id = _uid AND currency = _cur
    FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        escrow_balance = escrow_balance + _amount,
        updated_at = now()
    WHERE user_id = _uid AND currency = _cur;

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status)
    VALUES (_uid, _cur, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending')
    RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur, false, 'pending', now());

  RETURN _new_id;
END;
$function$;