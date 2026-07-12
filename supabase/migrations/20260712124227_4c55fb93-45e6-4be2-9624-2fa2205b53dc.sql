
-- Fix: profiles PII exposure to anon/authenticated
-- Revoke column-level SELECT on sensitive columns from anon and authenticated.
-- Owner-side and admin reads go through server functions using the service-role
-- client, which bypasses column GRANTs, so those paths continue to work.
REVOKE SELECT (phone, country, address, kyc_selfie_path, kyc_id_path, kyc_completed_at)
  ON public.profiles FROM anon;
REVOKE SELECT (phone, country, address, kyc_selfie_path, kyc_id_path, kyc_completed_at)
  ON public.profiles FROM authenticated;

-- Fix: tighten system_wallets admin policy — explicit auth.uid() guard so
-- there is no ambiguity that anonymous callers are excluded.
DROP POLICY IF EXISTS "Admins can view system wallets" ON public.system_wallets;
CREATE POLICY "Admins can view system wallets"
  ON public.system_wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role));
