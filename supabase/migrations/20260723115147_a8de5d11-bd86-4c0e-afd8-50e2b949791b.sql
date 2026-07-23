
-- 1) Products: block anonymous SELECT of active products; require sign-in
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;
CREATE POLICY "Active products viewable by authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (status = 'active');
REVOKE SELECT ON public.products FROM anon;

-- 2) Email infra tables: scope policies to service_role role explicitly
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role manages send log"
  ON public.email_send_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role manages send state"
  ON public.email_send_state FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role manages unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3) ad_inquiries: defense-in-depth — revoke any anon grants (owner/admin policies stay)
REVOKE ALL ON public.ad_inquiries FROM anon;
