
CREATE POLICY "product-covers: public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-covers');

CREATE POLICY "product-covers: owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product-covers: owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-covers' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-covers' AND owner = auth.uid());

CREATE POLICY "product-covers: owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-covers' AND owner = auth.uid());
