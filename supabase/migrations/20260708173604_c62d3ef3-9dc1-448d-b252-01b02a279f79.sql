
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image','video'));

-- Storage policies for the post-media bucket
CREATE POLICY "post-media: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'post-media');

CREATE POLICY "post-media: users upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'post-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "post-media: users delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'post-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
