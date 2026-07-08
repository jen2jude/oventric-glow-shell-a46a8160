-- Tighten circle_requests SELECT: replace overly broad "USING true" with target-scoped policy
DROP POLICY IF EXISTS "authenticated can read requests where target" ON public.circle_requests;
CREATE POLICY "target can read incoming requests"
  ON public.circle_requests FOR SELECT
  TO authenticated
  USING (target_slug = public.current_user_slug());

-- Wallets: exclude anonymous (is_anonymous) sessions from SELECT/INSERT policies
DROP POLICY IF EXISTS "user can read own wallets" ON public.wallets;
CREATE POLICY "user can read own wallets"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

DROP POLICY IF EXISTS "user can seed own wallets" ON public.wallets;
CREATE POLICY "user can seed own wallets"
  ON public.wallets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Also lock wallet_transactions to non-anonymous authenticated sessions (same wallet scope)
DROP POLICY IF EXISTS "user can read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "user can read own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

DROP POLICY IF EXISTS "user can insert own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "user can insert own wallet transactions"
  ON public.wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Revoke public/anon EXECUTE on SECURITY DEFINER RLS helpers.
-- authenticated retains EXECUTE because RLS policies invoke these functions.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_slug() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_slug() FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_slug() TO authenticated, service_role;