
-- Extend bounties table
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS accepted_applicant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS solved_at timestamptz;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS admin_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS promoted boolean NOT NULL DEFAULT false;

ALTER TABLE public.bounties DROP CONSTRAINT IF EXISTS bounties_status_check;
ALTER TABLE public.bounties ADD CONSTRAINT bounties_status_check
  CHECK (status = ANY (ARRAY['pending_review','active','paused','closed','draft','rejected','solved','released','disputed']));

ALTER TABLE public.bounties DROP CONSTRAINT IF EXISTS bounties_dispute_status_check;
ALTER TABLE public.bounties ADD CONSTRAINT bounties_dispute_status_check
  CHECK (dispute_status = ANY (ARRAY['none','open','resolved']));

-- Applications table
CREATE TABLE IF NOT EXISTS public.bounty_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','accepted','rejected','withdrawn'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, applicant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounty_applications TO authenticated;
GRANT ALL ON public.bounty_applications TO service_role;

ALTER TABLE public.bounty_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users view applications" ON public.bounty_applications;
CREATE POLICY "Signed-in users view applications" ON public.bounty_applications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can apply once" ON public.bounty_applications;
CREATE POLICY "Users can apply once" ON public.bounty_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = applicant_id
    AND COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

DROP POLICY IF EXISTS "Owner/poster/admin can update apps" ON public.bounty_applications;
CREATE POLICY "Owner/poster/admin can update apps" ON public.bounty_applications
  FOR UPDATE TO authenticated
  USING (auth.uid() = applicant_id
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = bounty_id AND b.poster_id = auth.uid()))
  WITH CHECK (auth.uid() = applicant_id
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = bounty_id AND b.poster_id = auth.uid()));

DROP POLICY IF EXISTS "Applicant/admin can delete app" ON public.bounty_applications;
CREATE POLICY "Applicant/admin can delete app" ON public.bounty_applications
  FOR DELETE TO authenticated
  USING (auth.uid() = applicant_id OR public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS update_bounty_applications_updated_at ON public.bounty_applications;
CREATE TRIGGER update_bounty_applications_updated_at
  BEFORE UPDATE ON public.bounty_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lock poster funds into escrow on publish
CREATE OR REPLACE FUNCTION public.bounty_publish_lock(_bounty_id uuid, _amount_usd numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount_usd IS NULL OR _amount_usd < 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _amount_usd = 0 THEN RETURN; END IF;

  SELECT available_balance INTO _bal FROM public.wallets
    WHERE user_id = _uid AND currency = 'USD' FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount_usd THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount_usd,
        escrow_balance = escrow_balance + _amount_usd,
        updated_at = now()
    WHERE user_id = _uid AND currency = 'USD';

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_uid, 'BTY-'||substr(_bounty_id::text,1,8), 'Gig Bounty Escrowed',
            _amount_usd, 'USD', false, 'success', now());
END;
$$;

-- Release escrow (80% solver, 20% platform)
CREATE OR REPLACE FUNCTION public.bounty_release_escrow(_bounty_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (_b.accepted_applicant_id, 'USD', _solver)
  ON CONFLICT (user_id, currency) DO UPDATE
    SET available_balance = public.wallets.available_balance + EXCLUDED.available_balance,
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
$$;

-- Refund escrow to poster
CREATE OR REPLACE FUNCTION public.bounty_refund_escrow(_bounty_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _b public.bounties;
BEGIN
  SELECT * INTO _b FROM public.bounties WHERE id = _bounty_id FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _b.released_at IS NOT NULL THEN RAISE EXCEPTION 'already settled'; END IF;

  UPDATE public.wallets
    SET escrow_balance = GREATEST(escrow_balance - _b.price_usd, 0),
        available_balance = available_balance + _b.price_usd,
        updated_at = now()
    WHERE user_id = _b.poster_id AND currency = 'USD';

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_b.poster_id, 'BTY-'||substr(_bounty_id::text,1,8)||'-X',
            'Bounty Refund', _b.price_usd, 'USD', true, 'success', now());

  UPDATE public.bounties
    SET released_at = now(), status = 'closed', dispute_status = 'resolved',
        reject_reason = COALESCE(_reason, reject_reason)
    WHERE id = _bounty_id;
END;
$$;

-- Auto-release scanner
CREATE OR REPLACE FUNCTION public.bounty_auto_release_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row record; _n integer := 0;
BEGIN
  FOR _row IN
    SELECT id FROM public.bounties
    WHERE status = 'solved'
      AND admin_hold = false
      AND dispute_status = 'none'
      AND released_at IS NULL
      AND solved_at IS NOT NULL
      AND solved_at < now() - interval '48 hours'
  LOOP
    BEGIN
      PERFORM public.bounty_release_escrow(_row.id);
      _n := _n + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN _n;
END;
$$;

-- Cron every 15 minutes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bounty-auto-release') THEN
    PERFORM cron.schedule('bounty-auto-release','*/15 * * * *',
      $c$ SELECT public.bounty_auto_release_due(); $c$);
  END IF;
END $$;
