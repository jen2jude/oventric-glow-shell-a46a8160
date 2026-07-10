
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Public read of any object in the avatars bucket (avatars are meant to be seen).
DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
CREATE POLICY "avatars: public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Owner-scoped writes: object path must begin with <auth.uid()>/
DROP POLICY IF EXISTS "avatars: owner insert" ON storage.objects;
CREATE POLICY "avatars: owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );

DROP POLICY IF EXISTS "avatars: owner update" ON storage.objects;
CREATE POLICY "avatars: owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );

DROP POLICY IF EXISTS "avatars: owner delete" ON storage.objects;
CREATE POLICY "avatars: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );
