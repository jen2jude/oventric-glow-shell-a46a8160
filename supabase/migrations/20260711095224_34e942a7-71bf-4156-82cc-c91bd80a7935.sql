CREATE OR REPLACE FUNCTION public.wallet_credit(_user_id uuid, _amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (_user_id, 'USD', _amount)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET available_balance = public.wallets.available_balance + EXCLUDED.available_balance,
        updated_at = now();
END;
$function$;