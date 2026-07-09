
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS kyc_selfie_path text,
  ADD COLUMN IF NOT EXISTS kyc_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

-- RLS for kyc-selfies storage bucket. The bucket itself is created via the storage tool.
CREATE POLICY "users can read own kyc selfies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users can upload own kyc selfies"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users can update own kyc selfies"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-selfies' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users can delete own kyc selfies"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);
