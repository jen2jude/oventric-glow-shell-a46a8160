
-- =====================================================
-- 1. profiles: add username, verification_tier, reputation_stars
-- =====================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS verification_tier TEXT NOT NULL DEFAULT 'TIER_0',
  ADD COLUMN IF NOT EXISTS reputation_stars NUMERIC(3,2) NOT NULL DEFAULT 5.00;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_verification_tier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_tier_check
  CHECK (verification_tier IN ('TIER_0','TIER_1','TIER_2','TIER_3'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_reputation_stars_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reputation_stars_check
  CHECK (reputation_stars >= 0 AND reputation_stars <= 5);

-- Case-insensitive uniqueness for username (nullable rows allowed)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- =====================================================
-- 2. wallets: one row per (user_id, currency)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','NGN','GHS')),
  available_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  escrow_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  accumulated_cashback NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallets_positive_balances CHECK (
    available_balance >= 0 AND escrow_balance >= 0 AND accumulated_cashback >= 0
  ),
  CONSTRAINT wallets_user_currency_unique UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON public.wallets (user_id);

-- 2b. GRANTs — required before enabling RLS
GRANT SELECT, INSERT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

-- 2c. RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user can read own wallets" ON public.wallets;
CREATE POLICY "user can read own wallets"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can seed own wallets" ON public.wallets;
CREATE POLICY "user can seed own wallets"
  ON public.wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE policies — balance mutations are trusted-server only.

-- 2d. updated_at trigger
DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
