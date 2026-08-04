-- Remove Data API access for guests: no policies exist for anon and all app
-- access goes through trusted server code.
REVOKE ALL ON public.support_feedback FROM anon;

GRANT SELECT, INSERT ON public.support_feedback TO authenticated;
GRANT ALL ON public.support_feedback TO service_role;

-- Block temporary anonymous sign-in sessions from the authenticated policies.
DROP POLICY IF EXISTS "own feedback read" ON public.support_feedback;
CREATE POLICY "own feedback read"
  ON public.support_feedback
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
    AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "own feedback insert" ON public.support_feedback;
CREATE POLICY "own feedback insert"
  ON public.support_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
    AND user_id = auth.uid()
  );