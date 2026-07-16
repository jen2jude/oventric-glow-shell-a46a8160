CREATE POLICY "profile-covers: public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-covers');