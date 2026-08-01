-- 1) profiles: column-level lockdown of sensitive PII
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  user_id, slug, display_name, created_at, updated_at, username, verification_tier,
  reputation_stars, country, kyc_completed_at, profile_completed_at, avatar_path, bio,
  notification_preferences, cover_path, flagged, flag_reason, banned_at, deleted_at,
  has_seen_feature_carousel, address_public, dob_public
) ON public.profiles TO anon, authenticated;

-- 2) products: hide direct seller contact info from anonymous visitors
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, seller_id, name, category, description, price_usd, hue, cover_path, file_path,
  external_url, vendor, rating, reviews, promoted, created_at, updated_at,
  original_currency, original_amount, fx_snapshot, kind, status, reject_reason,
  subcategory, condition, brand, location, negotiable, delivery, image_paths,
  requires_manual_delivery
) ON public.products TO anon;

-- 3) ad_campaigns: advertiser contact fields out of the public/authenticated read path
REVOKE SELECT ON public.ad_campaigns FROM anon, authenticated;
GRANT SELECT (
  id, title, advertiser, description, status, tier, header, body, media_path, media_url,
  placements, cta_type, cta_url, cta_label, start_at, end_at, created_by, created_at,
  updated_at, advertiser_user_id, countries, cities, daily_budget_usd, total_budget_usd,
  spent_usd, priority, escrow_locked
) ON public.ad_campaigns TO anon, authenticated;

-- 4) storage payment proofs: exclude anonymous (guest) JWT sessions
DROP POLICY IF EXISTS payment_proofs_select_own ON storage.objects;
CREATE POLICY payment_proofs_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finance'::app_role)
    )
  );

DROP POLICY IF EXISTS payment_proofs_delete_own ON storage.objects;
CREATE POLICY payment_proofs_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
