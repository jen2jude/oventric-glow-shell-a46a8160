
-- Drop existing course-media policies
DROP POLICY IF EXISTS "course-media authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "course-media authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "course-media owner update" ON storage.objects;
DROP POLICY IF EXISTS "course-media owner delete" ON storage.objects;

-- INSERT: only into own folder (first path segment = auth.uid())
CREATE POLICY "course-media owner upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-media'
  AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: uploader only (or admin). Public catalog/enrolled reads use signed URLs from server.
CREATE POLICY "course-media owner or admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-media'
  AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- UPDATE: only own folder
CREATE POLICY "course-media owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-media'
  AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'course-media'
  AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: only own folder
CREATE POLICY "course-media owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-media'
  AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  AND (storage.foldername(name))[1] = auth.uid()::text
);
