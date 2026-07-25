
-- 1) Add bounty_balance column to wallets
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS bounty_balance NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Refresh non-negative check to include bounty_balance
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_positive_balances;
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_positive_balances CHECK (
    available_balance >= 0
    AND escrow_balance >= 0
    AND accumulated_cashback >= 0
    AND bounty_balance >= 0
  );

-- 2) Rewire bounty_release_escrow to credit solver's bounty_balance instead of available_balance
CREATE OR REPLACE FUNCTION public.bounty_release_escrow(_bounty_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _b public.bounties; _solver numeric; _platform numeric;
BEGIN
  SELECT * INTO _b FROM public.bounties WHERE id = _bounty_id FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _b.released_at IS NOT NULL THEN RAISE EXCEPTION 'already settled'; END IF;
  IF _b.accepted_applicant_id IS NULL THEN RAISE EXCEPTION 'no accepted solver'; END IF;
  IF _b.admin_hold THEN RAISE EXCEPTION 'funds on hold'; END IF;
  IF _b.dispute_status = 'open' THEN RAISE EXCEPTION 'dispute open'; END IF;

  _solver := round((_b.price_usd * 0.8)::numeric, 2);
  _platform := round((_b.price_usd - _solver)::numeric, 2);

  UPDATE public.wallets
    SET escrow_balance = GREATEST(escrow_balance - _b.price_usd, 0),
        updated_at = now()
    WHERE user_id = _b.poster_id AND currency = 'USD';

  -- Credit the solver's dedicated Bounty Wallet (USD)
  INSERT INTO public.wallets (user_id, currency, bounty_balance)
    VALUES (_b.accepted_applicant_id, 'USD', _solver)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET bounty_balance = public.wallets.bounty_balance + EXCLUDED.bounty_balance,
        updated_at = now();

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_b.accepted_applicant_id, 'BTY-'||substr(_bounty_id::text,1,8)||'-R',
            'Bounty Payout', _solver, 'USD', true, 'success', now());

  UPDATE public.system_wallets SET balance_usd = balance_usd + _platform, updated_at = now() WHERE kind = 'bounty';
  INSERT INTO public.system_wallet_transactions(kind, amount_usd, source, ref_id, meta)
    VALUES ('bounty', _platform, 'bounty_release', _b.id,
            jsonb_build_object('solver_id', _b.accepted_applicant_id, 'poster_id', _b.poster_id));

  UPDATE public.bounties SET released_at = now(), status = 'released' WHERE id = _bounty_id;
END;
$function$;

-- 3) User-callable: move bounty balance -> main available_balance (USD)
CREATE OR REPLACE FUNCTION public.bounty_wallet_transfer_to_main(_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  SELECT bounty_balance INTO _bal FROM public.wallets
    WHERE user_id = _uid AND currency = 'USD' FOR UPDATE;
  IF COALESCE(_bal, 0) < _amount THEN RAISE EXCEPTION 'insufficient bounty balance'; END IF;

  UPDATE public.wallets
    SET bounty_balance = bounty_balance - _amount,
        available_balance = available_balance + _amount,
        updated_at = now()
    WHERE user_id = _uid AND currency = 'USD';

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'BTM-'||substr(gen_random_uuid()::text,1,8), 'Bounty To Main', _amount, 'USD', true, 'success', now());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bounty_wallet_transfer_to_main(numeric) TO authenticated;

-- 4) Admin-only: reset a user's wallet balance component
--    _which: 'available' | 'escrow' | 'cashback' | 'bounty' | 'all'
CREATE OR REPLACE FUNCTION public.admin_reset_wallet(_user_id uuid, _currency text, _which text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _w record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  IF _which NOT IN ('available','escrow','cashback','bounty','all') THEN
    RAISE EXCEPTION 'invalid target';
  END IF;

  -- Ensure row exists so the update lands somewhere.
  INSERT INTO public.wallets (user_id, currency) VALUES (_user_id, _currency)
    ON CONFLICT (user_id, currency) DO NOTHING;

  SELECT * INTO _w FROM public.wallets
    WHERE user_id = _user_id AND currency = _currency FOR UPDATE;

  UPDATE public.wallets SET
    available_balance    = CASE WHEN _which IN ('available','all') THEN 0 ELSE available_balance END,
    escrow_balance       = CASE WHEN _which IN ('escrow','all')    THEN 0 ELSE escrow_balance END,
    accumulated_cashback = CASE WHEN _which IN ('cashback','all')  THEN 0 ELSE accumulated_cashback END,
    bounty_balance       = CASE WHEN _which IN ('bounty','all')    THEN 0 ELSE bounty_balance END,
    updated_at = now()
    WHERE user_id = _user_id AND currency = _currency;

  INSERT INTO public.audit_logs (actor_id, action, target_id, meta)
    VALUES (auth.uid(), 'wallet.reset', _user_id,
      jsonb_build_object(
        'currency', _currency,
        'which', _which,
        'previous', jsonb_build_object(
          'available', _w.available_balance,
          'escrow', _w.escrow_balance,
          'cashback', _w.accumulated_cashback,
          'bounty', COALESCE(_w.bounty_balance, 0)
        )
      ));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_reset_wallet(uuid, text, text) TO authenticated;
