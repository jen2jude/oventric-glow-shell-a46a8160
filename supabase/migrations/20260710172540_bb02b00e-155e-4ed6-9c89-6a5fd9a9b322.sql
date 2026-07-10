
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_debit(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_debit(uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.system_wallet_credit(text, numeric, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_wallet_credit(text, numeric, text, uuid, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.payout_request_create(text, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_mark_paid(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payout_request_reject(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_slug() FROM anon;
REVOKE EXECUTE ON FUNCTION public.profile_social_counts(text) FROM anon;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  user_id, slug, display_name, username, avatar_path, bio,
  verification_tier, reputation_stars, created_at, updated_at,
  profile_completed_at, notification_preferences
) ON public.profiles TO authenticated;
GRANT SELECT (
  user_id, slug, display_name, username, avatar_path, bio,
  verification_tier, reputation_stars, created_at, updated_at,
  profile_completed_at
) ON public.profiles TO anon;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Anyone can read bounty covers" ON storage.objects;
CREATE POLICY "Authenticated can read bounty covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'bounty-covers');

DROP POLICY IF EXISTS "Anyone can view course covers" ON storage.objects;
CREATE POLICY "Authenticated can view course covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'course-covers');
