
-- Announcements: audience-aware read for authenticated
DROP POLICY IF EXISTS "Authenticated reads active announcements" ON public.announcements;
CREATE POLICY "Authenticated reads targeted announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (active AND audience IN ('everyone','authenticated'));

-- Audit logs: remove client-side insert forgery
DROP POLICY IF EXISTS "Authenticated can insert audit logs about themselves" ON public.audit_logs;

-- Wallet transactions: remove client-side insert forgery
DROP POLICY IF EXISTS "user can insert own wallet transactions" ON public.wallet_transactions;

-- System wallets: explicit non-anonymous admin check
DROP POLICY IF EXISTS "Admins can view system wallets" ON public.system_wallets;
CREATE POLICY "Admins can view system wallets"
  ON public.system_wallets
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix mutable search_path on email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';

-- Revoke EXECUTE from public/anon on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION
  public.is_circle_member(uuid, uuid),
  public.is_circle_admin(uuid, uuid),
  public.has_role(uuid, app_role),
  public.current_user_slug(),
  public.profile_social_counts(text),
  public.payout_request_create(text, numeric, text, jsonb),
  public.payout_request_mark_paid(uuid, text),
  public.payout_request_reject(uuid, text),
  public.wallet_credit(uuid, numeric),
  public.wallet_debit(uuid, numeric),
  public.system_wallet_credit(text, numeric, text, uuid, jsonb),
  public.enqueue_email(text, jsonb),
  public.read_email_batch(text, integer, integer),
  public.delete_email(text, bigint),
  public.move_to_dlq(text, text, bigint, jsonb),
  public.email_queue_dispatch(),
  public.email_queue_wake()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.is_circle_member(uuid, uuid),
  public.is_circle_admin(uuid, uuid),
  public.has_role(uuid, app_role),
  public.current_user_slug(),
  public.profile_social_counts(text),
  public.payout_request_create(text, numeric, text, jsonb),
  public.payout_request_mark_paid(uuid, text),
  public.payout_request_reject(uuid, text)
TO authenticated;
