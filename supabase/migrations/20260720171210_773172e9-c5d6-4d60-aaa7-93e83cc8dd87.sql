-- Drop existing broad read policies (they granted access to every column via row-scoped RLS)
DROP POLICY IF EXISTS "anon can read public profile columns" ON public.profiles;
DROP POLICY IF EXISTS "authenticated can read public profile columns" ON public.profiles;
DROP POLICY IF EXISTS "user can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "user can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "user can insert own profile" ON public.profiles;

-- Column-level SELECT: only safe display fields are exposed to anon and authenticated.
-- Sensitive fields (phone, address, country, date_of_birth, kyc_*, deletion_*, flag_*, banned_at, notification_preferences)
-- are readable only by the row owner via server-side service_role helpers.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  user_id,
  slug,
  display_name,
  username,
  bio,
  avatar_path,
  cover_path,
  verification_tier,
  reputation_stars,
  deleted_at,
  profile_completed_at,
  kyc_completed_at,
  created_at,
  updated_at
) ON public.profiles TO anon, authenticated;

-- Public row-visibility policy (columns already gated by GRANT above)
CREATE POLICY "anon can read public profile columns"
  ON public.profiles FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY "authenticated can read public profile columns"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND deleted_at IS NULL
  );

-- Own-profile policies: block anonymous JWT sessions everywhere.
CREATE POLICY "user can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = user_id
  );

CREATE POLICY "user can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = user_id
  )
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = user_id
  );

CREATE POLICY "user can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = user_id
  );