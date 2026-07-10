
CREATE POLICY "Anyone can view course covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-covers');

CREATE POLICY "Authenticated upload course covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner or admin update course covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-covers' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Owner or admin delete course covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-covers' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role)));
