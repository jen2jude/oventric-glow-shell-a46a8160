ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_id_path text;
REVOKE SELECT (kyc_id_path) ON public.profiles FROM anon;
GRANT SELECT (kyc_id_path) ON public.profiles TO authenticated;
GRANT UPDATE (kyc_id_path) ON public.profiles TO authenticated;