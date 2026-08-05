-- 1) support_chat_messages: exclude anonymous JWT sessions
DROP POLICY IF EXISTS "own chat read" ON public.support_chat_messages;
CREATE POLICY "own chat read" ON public.support_chat_messages
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "admin chat update" ON public.support_chat_messages;
CREATE POLICY "admin chat update" ON public.support_chat_messages
  FOR UPDATE TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "own chat insert" ON public.support_chat_messages;
CREATE POLICY "own chat insert" ON public.support_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND (((user_id = auth.uid()) AND (sender = 'user')) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- 2) ad_campaigns: column-level SELECT so advertiser contact PII is never public
REVOKE SELECT ON public.ad_campaigns FROM anon, authenticated;
GRANT SELECT (
  id, title, advertiser, description, status, tier, header, body, media_path, media_url,
  placements, cta_type, cta_url, cta_label, start_at, end_at, created_by, created_at,
  updated_at, advertiser_user_id, cta_whatsapp, countries, cities,
  daily_budget_usd, total_budget_usd, spent_usd, priority, escrow_locked
) ON public.ad_campaigns TO anon, authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;

-- 3) profiles: column-level SELECT so phone/address/DOB/KYC paths are never
--    readable through the Data API. Owner + admin access to those fields goes
--    through server-side code (service role) which is unaffected by grants.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  user_id, slug, display_name, created_at, updated_at, username, verification_tier,
  reputation_stars, country, kyc_completed_at, profile_completed_at, avatar_path, bio,
  notification_preferences, cover_path, flagged, flag_reason, banned_at, deleted_at,
  has_seen_feature_carousel, address_public, dob_public, social_links, skills,
  last_liveness_verified_at
) ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
