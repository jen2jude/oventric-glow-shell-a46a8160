
-- 1) profiles: hide sensitive columns from anon
REVOKE SELECT (phone, country, kyc_selfie_path, kyc_completed_at) ON public.profiles FROM anon;

-- 2) wallets: exclude anonymous sessions
DROP POLICY IF EXISTS "user can read own wallets" ON public.wallets;
DROP POLICY IF EXISTS "user can seed own wallets" ON public.wallets;
CREATE POLICY "user can read own wallets" ON public.wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
CREATE POLICY "user can seed own wallets" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

-- 3) wallet_transactions: exclude anonymous sessions
DROP POLICY IF EXISTS "user can read own wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "user can insert own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "user can read own wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
CREATE POLICY "user can insert own wallet transactions" ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

-- 4) revoke execute on internal trigger fn from anon/public
REVOKE EXECUTE ON FUNCTION public.grant_admin_to_seed_email() FROM PUBLIC, anon, authenticated;

-- 5) storage policies: exclude anonymous sessions
ALTER POLICY "Sellers delete own product files" ON storage.objects
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "Sellers manage own product files" ON storage.objects
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
  WITH CHECK (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "Sellers read own product files" ON storage.objects
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "post-media: users delete own files" ON storage.objects
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "post-media: authenticated read" ON storage.objects
  USING (bucket_id = 'post-media' AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "product-covers: owner delete" ON storage.objects
  USING (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "product-covers: owner update" ON storage.objects
  USING (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
  WITH CHECK (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "users can delete own kyc selfies" ON storage.objects
  USING (bucket_id = 'kyc-selfies' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "users can read own kyc selfies" ON storage.objects
  USING (bucket_id = 'kyc-selfies' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "users can update own kyc selfies" ON storage.objects
  USING (bucket_id = 'kyc-selfies' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
  WITH CHECK (bucket_id = 'kyc-selfies' AND auth.uid()::text = (storage.foldername(name))[1] AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "Anyone can read bounty covers" ON storage.objects
  USING (bucket_id = 'bounty-covers');
ALTER POLICY "Users delete own bounty covers, admin any" ON storage.objects
  USING (bucket_id = 'bounty-covers' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role)) AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
ALTER POLICY "Users update own bounty covers, admin any" ON storage.objects
  USING (bucket_id = 'bounty-covers' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role)) AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
  WITH CHECK (bucket_id = 'bounty-covers' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role)) AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
