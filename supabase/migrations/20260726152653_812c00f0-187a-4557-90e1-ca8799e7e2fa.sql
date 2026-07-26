
-- Lock escrow in the poster's home currency wallet
CREATE OR REPLACE FUNCTION public.bounty_publish_lock_currency(_bounty_id uuid, _amount numeric, _currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN RAISE EXCEPTION 'invalid currency'; END IF;
  IF _amount = 0 THEN RETURN; END IF;

  INSERT INTO public.wallets (user_id, currency) VALUES (_uid, _currency)
  ON CONFLICT (user_id, currency) DO NOTHING;

  SELECT available_balance INTO _bal FROM public.wallets
    WHERE user_id = _uid AND currency = _currency FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        escrow_balance = escrow_balance + _amount,
        updated_at = now()
    WHERE user_id = _uid AND currency = _currency;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'BTY-'||substr(_bounty_id::text,1,8), 'Gig Bounty Escrowed',
            _amount, _currency::public.wallet_currency, false, 'success', now());
END;
$$;

-- Release escrow in the bounty's original currency (fallback to USD)
CREATE OR REPLACE FUNCTION public.bounty_release_escrow(_bounty_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b public.bounties;
  _cur text;
  _amt numeric;
  _solver numeric;
  _platform numeric;
  _fx numeric;
  _platform_usd numeric;
BEGIN
  SELECT * INTO _b FROM public.bounties WHERE id = _bounty_id FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _b.released_at IS NOT NULL THEN RAISE EXCEPTION 'already settled'; END IF;
  IF _b.accepted_applicant_id IS NULL THEN RAISE EXCEPTION 'no accepted solver'; END IF;
  IF _b.admin_hold THEN RAISE EXCEPTION 'funds on hold'; END IF;
  IF _b.dispute_status = 'open' THEN RAISE EXCEPTION 'dispute open'; END IF;

  _cur := COALESCE(NULLIF(_b.original_currency,''), 'USD');
  _amt := COALESCE(_b.original_amount, _b.price_usd);

  _solver := round((_amt * 0.8)::numeric, 2);
  _platform := round((_amt - _solver)::numeric, 2);

  UPDATE public.wallets
    SET escrow_balance = GREATEST(escrow_balance - _amt, 0),
        updated_at = now()
    WHERE user_id = _b.poster_id AND currency = _cur;

  INSERT INTO public.wallets (user_id, currency, bounty_balance)
    VALUES (_b.accepted_applicant_id, _cur, _solver)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET bounty_balance = public.wallets.bounty_balance + EXCLUDED.bounty_balance,
        updated_at = now();

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_b.accepted_applicant_id, 'BTY-'||substr(_bounty_id::text,1,8)||'-R',
            'Bounty Payout', _solver, _cur::public.wallet_currency, true, 'success', now());

  -- Platform cut: convert to USD for system wallet using bounty fx_snapshot when available
  IF _cur = 'USD' THEN
    _platform_usd := _platform;
  ELSE
    BEGIN
      _fx := NULLIF((_b.fx_snapshot->'rates'->>_cur)::numeric, 0);
    EXCEPTION WHEN OTHERS THEN _fx := NULL;
    END;
    IF _fx IS NULL OR _fx <= 0 THEN
      _fx := CASE _cur WHEN 'NGN' THEN 1500 WHEN 'GHS' THEN 14 ELSE 1 END;
    END IF;
    _platform_usd := round((_platform / _fx)::numeric, 2);
  END IF;

  IF _platform_usd > 0 THEN
    UPDATE public.system_wallets SET balance_usd = balance_usd + _platform_usd, updated_at = now() WHERE kind = 'bounty';
    INSERT INTO public.system_wallet_transactions(kind, amount_usd, source, ref_id, meta)
      VALUES ('bounty', _platform_usd, 'bounty_release', _b.id,
              jsonb_build_object('solver_id', _b.accepted_applicant_id, 'poster_id', _b.poster_id,
                                 'currency', _cur, 'platform_local', _platform));
  END IF;

  UPDATE public.bounties SET released_at = now(), status = 'released' WHERE id = _bounty_id;
END;
$$;

-- Refund escrow in bounty's original currency
CREATE OR REPLACE FUNCTION public.bounty_refund_escrow(_bounty_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _b public.bounties; _cur text; _amt numeric;
BEGIN
  SELECT * INTO _b FROM public.bounties WHERE id = _bounty_id FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _b.released_at IS NOT NULL THEN RAISE EXCEPTION 'already settled'; END IF;

  _cur := COALESCE(NULLIF(_b.original_currency,''), 'USD');
  _amt := COALESCE(_b.original_amount, _b.price_usd);

  UPDATE public.wallets
    SET escrow_balance = GREATEST(escrow_balance - _amt, 0),
        available_balance = available_balance + _amt,
        updated_at = now()
    WHERE user_id = _b.poster_id AND currency = _cur;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_b.poster_id, 'BTY-'||substr(_bounty_id::text,1,8)||'-X',
            'Bounty Refund', _amt, _cur::public.wallet_currency, true, 'success', now());

  UPDATE public.bounties
    SET released_at = now(), status = 'closed', dispute_status = 'resolved',
        reject_reason = COALESCE(_reason, reject_reason)
    WHERE id = _bounty_id;
END;
$$;
