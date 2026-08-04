DROP POLICY IF EXISTS "own tickets read" ON public.support_tickets;
CREATE POLICY "own tickets read" ON public.support_tickets
FOR SELECT TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "admin tickets update" ON public.support_tickets;
CREATE POLICY "admin tickets update" ON public.support_tickets
FOR UPDATE TO authenticated
USING (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "own tickets insert" ON public.support_tickets;
CREATE POLICY "own tickets insert" ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  AND user_id = auth.uid()
);