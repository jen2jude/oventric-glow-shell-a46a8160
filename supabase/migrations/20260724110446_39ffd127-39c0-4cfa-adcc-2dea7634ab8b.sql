
CREATE OR REPLACE FUNCTION public.wallet_debit_currency(_user_id uuid, _amount numeric, _currency text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bal NUMERIC;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;

  SELECT available_balance INTO _bal
    FROM public.wallets
    WHERE user_id = _user_id AND currency = _currency
    FOR UPDATE;

  IF _bal IS NULL OR _bal < _amount THEN RETURN false; END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        updated_at = now()
    WHERE user_id = _user_id AND currency = _currency;

  RETURN true;
END;
$$;
