
-- Allow authenticated users to upload to circle-avatars and circle-covers under their own userId prefix
DROP POLICY IF EXISTS "circle_images_owner_write" ON storage.objects;
CREATE POLICY "circle_images_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('circle-avatars', 'circle-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "circle_images_owner_update" ON storage.objects;
CREATE POLICY "circle_images_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('circle-avatars', 'circle-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "circle_images_owner_delete" ON storage.objects;
CREATE POLICY "circle_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('circle-avatars', 'circle-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "circle_images_authenticated_read" ON storage.objects;
CREATE POLICY "circle_images_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('circle-avatars', 'circle-covers'));
