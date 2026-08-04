-- 1) Liveness attestation ---------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_liveness_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_liveness_attestation()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _kyc timestamptz;
BEGIN
  IF _uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT kyc_completed_at INTO _kyc FROM public.profiles WHERE user_id = _uid;
  IF _kyc IS NULL THEN RAISE EXCEPTION 'kyc not completed'; END IF;
  UPDATE public.profiles SET last_liveness_verified_at = now(), updated_at = now()
    WHERE user_id = _uid;
  RETURN now();
END; $$;

REVOKE ALL ON FUNCTION public.record_liveness_attestation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_liveness_attestation() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_recent_liveness()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _ts timestamptz;
BEGIN
  SELECT last_liveness_verified_at INTO _ts FROM public.profiles WHERE user_id = auth.uid();
  IF _ts IS NULL OR _ts < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'liveness verification required';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.assert_recent_liveness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_recent_liveness() TO authenticated, service_role;

-- 2) Enforce attestation on payout creation ---------------------------------
CREATE OR REPLACE FUNCTION public.payout_request_create(_currency text, _amount numeric, _method text, _destination jsonb)
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
  PERFORM public.assert_recent_liveness();
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _currency NOT IN ('USD','NGN','GHS') THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;
  IF _method NOT IN ('bank','momo','wire') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;

  _cur := _currency;

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
  VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur::public.wallet_currency, false, 'pending', now());

  RETURN _new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_request_create_live(_currency text, _amount numeric, _fee numeric, _net numeric, _method text, _destination jsonb, _recipient_id uuid, _recipient_code text)
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
  PERFORM public.assert_recent_liveness();
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _currency NOT IN ('NGN','GHS') THEN
    RAISE EXCEPTION 'live payouts only for NGN/GHS';
  END IF;
  IF _method NOT IN ('bank','momo') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;

  _cur := _currency;

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

  INSERT INTO public.payout_requests(user_id, currency, amount, method, destination, status,
    fee_amount, net_amount, recipient_id, paystack_recipient_code)
  VALUES (_uid, _cur, _amount, _method, COALESCE(_destination,'{}'::jsonb), 'pending',
    _fee, _net, _recipient_id, _recipient_code)
  RETURNING id INTO _new_id;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
  VALUES (_uid, 'PYT-'||substr(_new_id::text,1,8), 'Payout Withdrawal', _amount, _cur::public.wallet_currency, false, 'pending', now());

  RETURN _new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payout_request_create_live(_currency text, _amount numeric, _fee numeric, _net numeric, _method text, _destination jsonb, _recipient_id uuid, _recipient_code text, _provider text DEFAULT 'paystack'::text)
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
  PERFORM public.assert_recent_liveness();
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

-- 3) Re-assert column-level privacy on profiles ------------------------------
REVOKE SELECT ON public.profiles FROM anon, authenticated;
REVOKE SELECT (phone, address, date_of_birth, kyc_selfie_path, kyc_id_path,
               deletion_liveness_path, deletion_reason, last_liveness_verified_at)
  ON public.profiles FROM anon, authenticated;
GRANT SELECT (user_id, slug, display_name, username, bio, avatar_path, cover_path,
              verification_tier, reputation_stars, country, kyc_completed_at,
              profile_completed_at, flagged, flag_reason, banned_at, deleted_at,
              has_seen_feature_carousel, address_public, dob_public,
              created_at, updated_at)
  ON public.profiles TO anon, authenticated;
GRANT SELECT (notification_preferences, social_links, skills)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 4) Re-assert column-level privacy on ad_campaigns contact fields -----------
REVOKE SELECT ON public.ad_campaigns FROM anon, authenticated;
REVOKE SELECT (advertiser_email, advertiser_whatsapp, cta_lead_email)
  ON public.ad_campaigns FROM anon, authenticated;
GRANT SELECT (id, title, advertiser, description, status, tier, header, body,
              media_path, media_url, placements, cta_type, cta_url, cta_label,
              cta_whatsapp, start_at, end_at, created_by, advertiser_user_id,
              countries, cities, daily_budget_usd, total_budget_usd, spent_usd,
              priority, escrow_locked, created_at, updated_at)
  ON public.ad_campaigns TO anon, authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;

-- 5) Block anonymous (guest) sessions from user-photos storage ---------------
DROP POLICY IF EXISTS "user photos read own" ON storage.objects;
CREATE POLICY "user photos read own" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
);

DROP POLICY IF EXISTS "user photos update own" ON storage.objects;
CREATE POLICY "user photos update own" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
);

DROP POLICY IF EXISTS "user photos insert own" ON storage.objects;
CREATE POLICY "user photos insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
);

DROP POLICY IF EXISTS "user photos delete own" ON storage.objects;
CREATE POLICY "user photos delete own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
);