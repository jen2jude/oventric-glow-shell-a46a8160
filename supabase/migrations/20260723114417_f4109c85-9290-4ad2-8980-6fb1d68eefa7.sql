
DROP POLICY IF EXISTS "post-media: authenticated read" ON storage.objects;

CREATE POLICY "post-media: owner or admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media'
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "post-media: users update own files" ON storage.objects;
CREATE POLICY "post-media: users update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-media'
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'post-media'
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND (storage.foldername(name))[1] = auth.uid()::text
);
