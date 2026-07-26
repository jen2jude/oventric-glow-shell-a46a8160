GRANT SELECT ON public.bounties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bounties TO authenticated;
GRANT ALL ON public.bounties TO service_role;