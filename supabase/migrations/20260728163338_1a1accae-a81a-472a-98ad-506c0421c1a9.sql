-- 1) Paid content: replace permissive SELECT policy on course_modules
DROP POLICY IF EXISTS "Anyone can view modules of published courses" ON public.course_modules;

CREATE POLICY "View course modules (preview, owner, admin, enrolled)"
ON public.course_modules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_modules.course_id
      AND (
        -- Preview lessons on a published course are public
        (c.is_published = true AND course_modules.is_preview = true)
        -- Free published courses are fully accessible
        OR (c.is_published = true AND c.is_free = true)
        -- Owner / admin always
        OR c.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        -- Enrolled users
        OR EXISTS (
          SELECT 1 FROM public.course_enrollments e
          WHERE e.course_id = c.id AND e.user_id = auth.uid()
        )
      )
  )
);

-- 2) Circle image storage: block anonymous (is_anonymous) sessions
DROP POLICY IF EXISTS circle_images_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS circle_images_owner_update ON storage.objects;
DROP POLICY IF EXISTS circle_images_owner_delete ON storage.objects;
DROP POLICY IF EXISTS circle_images_owner_write ON storage.objects;

CREATE POLICY circle_images_authenticated_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = ANY (ARRAY['circle-avatars','circle-covers'])
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

CREATE POLICY circle_images_owner_write
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['circle-avatars','circle-covers'])
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

CREATE POLICY circle_images_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = ANY (ARRAY['circle-avatars','circle-covers'])
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

CREATE POLICY circle_images_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = ANY (ARRAY['circle-avatars','circle-covers'])
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);