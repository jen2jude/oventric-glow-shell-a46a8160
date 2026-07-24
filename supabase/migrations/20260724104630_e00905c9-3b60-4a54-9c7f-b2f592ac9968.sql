-- Cashback debit: atomically subtracts from accumulated_cashback only.
-- Cashback is a "spend at checkout" balance; never touches available_balance,
-- so it is naturally excluded from payout_request_create.
CREATE OR REPLACE FUNCTION public.cashback_debit(_user_id UUID, _amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _bal NUMERIC;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN FALSE; END IF;
  SELECT accumulated_cashback INTO _bal
    FROM public.wallets
    WHERE user_id = _user_id AND currency = 'USD'
    FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN RETURN FALSE; END IF;
  UPDATE public.wallets
    SET accumulated_cashback = accumulated_cashback - _amount,
        updated_at = now()
    WHERE user_id = _user_id AND currency = 'USD';
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.cashback_debit(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cashback_debit(UUID, NUMERIC) TO service_role;

-- Cashback credit: additive counterpart, service-role only.
CREATE OR REPLACE FUNCTION public.cashback_credit(_user_id UUID, _amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.wallets (user_id, currency, accumulated_cashback)
    VALUES (_user_id, 'USD', _amount)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET accumulated_cashback = public.wallets.accumulated_cashback + EXCLUDED.accumulated_cashback,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.cashback_credit(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cashback_credit(UUID, NUMERIC) TO service_role;