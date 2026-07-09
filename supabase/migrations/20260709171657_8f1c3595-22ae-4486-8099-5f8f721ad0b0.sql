
-- product-files RLS: sellers upload/manage own folder; reads gated via signed URLs from server
CREATE POLICY "Sellers upload own product files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sellers manage own product files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sellers delete own product files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sellers read own product files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);
