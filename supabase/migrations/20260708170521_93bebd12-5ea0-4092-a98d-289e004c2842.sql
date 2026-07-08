-- Restore simple owner-only checks on wallets / wallet_transactions.
-- The extra is_anonymous JWT check was rejecting legitimate first-time signups.

DROP POLICY IF EXISTS "user can read own wallets" ON public.wallets;
CREATE POLICY "user can read own wallets"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can seed own wallets" ON public.wallets;
CREATE POLICY "user can seed own wallets"
  ON public.wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "user can read own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can insert own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "user can insert own wallet transactions"
  ON public.wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);