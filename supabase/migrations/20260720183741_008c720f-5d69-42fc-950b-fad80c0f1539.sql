
CREATE POLICY "admin ad-media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin ad-media write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin ad-media update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin ad-media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-media' AND public.has_role(auth.uid(),'admin'::app_role));
