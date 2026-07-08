
-- Restrict user_roles SELECT to non-anonymous authenticated users
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- Allow authenticated (non-anonymous) users to submit post reports
CREATE POLICY "Authenticated users can submit reports"
ON public.post_reports
FOR INSERT
TO authenticated
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
