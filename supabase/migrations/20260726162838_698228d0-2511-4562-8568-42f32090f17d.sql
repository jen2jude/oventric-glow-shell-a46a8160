GRANT SELECT ON public.bounties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounties TO authenticated;
GRANT ALL ON public.bounties TO service_role;

DROP POLICY IF EXISTS "Bounties are viewable by anyone" ON public.bounties;
CREATE POLICY "Bounties are viewable by anyone"
ON public.bounties
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can create their own bounties" ON public.bounties;
CREATE POLICY "Users can create their own bounties"
ON public.bounties
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Owners and admins can update bounties" ON public.bounties;
CREATE POLICY "Owners and admins can update bounties"
ON public.bounties
FOR UPDATE
TO authenticated
USING (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Owners and admins can delete bounties" ON public.bounties;
CREATE POLICY "Owners and admins can delete bounties"
ON public.bounties
FOR DELETE
TO authenticated
USING (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::public.app_role));