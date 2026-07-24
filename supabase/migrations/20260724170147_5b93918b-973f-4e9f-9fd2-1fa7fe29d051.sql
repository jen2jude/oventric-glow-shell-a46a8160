
-- Add new wallet transaction types for seller credits and cashback earnings
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'Marketplace Sale';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'Cashback Earned';

-- Atomic credit function that supports arbitrary currency (NGN/GHS/USD).
CREATE OR REPLACE FUNCTION public.wallet_credit_currency(_user_id uuid, _amount numeric, _currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (_user_id, _currency::wallet_currency, _amount)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET available_balance = public.wallets.available_balance + EXCLUDED.available_balance,
        updated_at = now();
END;
$$;
