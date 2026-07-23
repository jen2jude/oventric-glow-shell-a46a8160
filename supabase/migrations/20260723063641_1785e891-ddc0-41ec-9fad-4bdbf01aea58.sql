-- RLS policies for course-media bucket
CREATE POLICY "course-media authenticated upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-media' AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY "course-media authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-media' AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY "course-media owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-media' AND owner = auth.uid());

CREATE POLICY "course-media owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-media' AND owner = auth.uid());