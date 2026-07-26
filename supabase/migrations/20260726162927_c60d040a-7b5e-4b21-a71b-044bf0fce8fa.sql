REVOKE ALL ON public.bounties FROM anon;
GRANT SELECT ON public.bounties TO anon;

REVOKE ALL ON public.bounties FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounties TO authenticated;

GRANT ALL ON public.bounties TO service_role;