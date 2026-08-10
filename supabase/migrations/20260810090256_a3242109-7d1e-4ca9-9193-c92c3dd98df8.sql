-- 1) Payment gateway settings: restrict reads to admin/finance roles
DROP POLICY IF EXISTS gateway_settings_read ON public.payment_gateway_settings;
CREATE POLICY gateway_settings_read ON public.payment_gateway_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- 2) Collections default to private
ALTER TABLE public.collections ALTER COLUMN is_public SET DEFAULT false;

-- 3) Advertiser contact fields: hard column lockdown for anon/authenticated
REVOKE SELECT ON public.ad_campaigns FROM anon, authenticated;
REVOKE SELECT (advertiser_email, advertiser_whatsapp, cta_lead_email) ON public.ad_campaigns FROM anon, authenticated;
GRANT SELECT (
  id, title, advertiser, description, status, tier, header, body, media_path, media_url,
  placements, cta_type, cta_url, cta_label, cta_whatsapp, start_at, end_at, created_by,
  created_at, updated_at, advertiser_user_id, countries, cities, daily_budget_usd,
  total_budget_usd, spent_usd, priority, escrow_locked
) ON public.ad_campaigns TO anon, authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;

-- 4) Story media storage policies must never match anonymous (guest) sessions
DROP POLICY IF EXISTS story_media_select_own ON storage.objects;
CREATE POLICY story_media_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'story-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

DROP POLICY IF EXISTS story_media_delete_own ON storage.objects;
CREATE POLICY story_media_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'story-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );