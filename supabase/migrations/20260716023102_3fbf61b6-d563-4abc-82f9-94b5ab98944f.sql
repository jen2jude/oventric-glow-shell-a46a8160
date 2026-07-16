
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_path text;

-- Storage RLS policies for user-owned files in the avatars and profile-covers
-- buckets. Files are namespaced by user id: "<uid>/<random>.<ext>".
DO $$
BEGIN
  -- avatars bucket: owner CRUD
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_read') THEN
    CREATE POLICY "avatars_owner_read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_write') THEN
    CREATE POLICY "avatars_owner_write" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_update') THEN
    CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_delete') THEN
    CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- profile-covers bucket: owner CRUD
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='covers_owner_read') THEN
    CREATE POLICY "covers_owner_read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='covers_owner_write') THEN
    CREATE POLICY "covers_owner_write" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='covers_owner_update') THEN
    CREATE POLICY "covers_owner_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='covers_owner_delete') THEN
    CREATE POLICY "covers_owner_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END$$;
