
-- 1) profiles: replace broad USING(true) SELECT policies with column-level grants
DROP POLICY IF EXISTS "public can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated can read profiles" ON public.profiles;

REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Safe, non-sensitive columns readable by everyone
GRANT SELECT (
  user_id, slug, display_name, username, verification_tier,
  reputation_stars, avatar_path, bio, cover_path,
  profile_completed_at, notification_preferences, flagged,
  created_at, updated_at
) ON public.profiles TO anon;

GRANT SELECT (
  user_id, slug, display_name, username, verification_tier,
  reputation_stars, avatar_path, bio, cover_path,
  profile_completed_at, notification_preferences, flagged,
  created_at, updated_at
) ON public.profiles TO authenticated;

-- Row-level policies still required for granted columns
CREATE POLICY "anon can read public profile columns"
  ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated can read public profile columns"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- 2) user_roles: block anonymous JWT sessions from the admin read policy
DROP POLICY IF EXISTS "Admins read all user_roles" ON public.user_roles;
CREATE POLICY "Admins read all user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) SECURITY DEFINER functions: remove anon EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payout_request_create_live(text, numeric, numeric, numeric, text, jsonb, uuid, text) TO service_role;
