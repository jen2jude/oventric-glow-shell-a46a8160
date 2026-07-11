-- 1) Revoke EXECUTE from anon on SECURITY DEFINER trigger helpers.
REVOKE EXECUTE ON FUNCTION public.notify_on_bounty()          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_circle_request()  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_direct_message()  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_order()           FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_payout()          FROM anon, PUBLIC;

-- 2) Exclude anonymous-signed-in users from the four flagged storage policies.
DROP POLICY IF EXISTS "Authenticated can read bounty covers"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view course covers"   ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete course covers"    ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin update course covers"    ON storage.objects;

CREATE POLICY "Authenticated can read bounty covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bounty-covers'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "Authenticated can view course covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "Owner or admin delete course covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Owner or admin update course covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
