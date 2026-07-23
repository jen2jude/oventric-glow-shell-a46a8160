
-- 1) profiles: revoke sensitive PII from anon + authenticated (owner/admin read via service_role)
REVOKE SELECT (phone, address, date_of_birth, kyc_id_path, kyc_selfie_path,
               deletion_reason, deletion_liveness_path, flag_reason, banned_at)
  ON public.profiles FROM anon, authenticated;

-- 2) products: revoke seller contact from anon + authenticated (RPC get_product_contact / get_my_product_contact)
REVOKE SELECT (seller_phone, whatsapp_number) ON public.products FROM anon, authenticated;

-- 3) ad_campaigns: revoke advertiser contact + lead email from anon + authenticated
--    (admin flows use supabaseAdmin; owner-only surfacing via future RPC if needed)
REVOKE SELECT (advertiser_email, advertiser_whatsapp, cta_lead_email)
  ON public.ad_campaigns FROM anon, authenticated;

-- 4) courses: revoke quiz answer keys from anon + authenticated
--    (Only written by author; served via sanitized RPCs or service_role.)
REVOKE SELECT (quizzes) ON public.courses FROM anon, authenticated;

-- 5) bounty_applications: replace broad SELECT with scoped policy
DROP POLICY IF EXISTS "Signed-in users view applications" ON public.bounty_applications;
CREATE POLICY "Applicant, poster, or admin view applications"
  ON public.bounty_applications
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND (
      auth.uid() = applicant_id
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.bounties b
         WHERE b.id = bounty_applications.bounty_id AND b.poster_id = auth.uid()
      )
    )
  );

-- 6) storage.ad-media: block anonymous JWTs on all four policies
DROP POLICY IF EXISTS "admin ad-media read" ON storage.objects;
DROP POLICY IF EXISTS "admin ad-media write" ON storage.objects;
DROP POLICY IF EXISTS "admin ad-media update" ON storage.objects;
DROP POLICY IF EXISTS "admin ad-media delete" ON storage.objects;

CREATE POLICY "admin ad-media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-media'
         AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
         AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin ad-media write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-media'
              AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
              AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin ad-media update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-media'
         AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
         AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'ad-media'
              AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
              AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin ad-media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-media'
         AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
         AND public.has_role(auth.uid(), 'admin'::app_role));

-- 7) Pin search_path on the only function still flagged as mutable
ALTER FUNCTION public.ad_price_per_event(text, text) SET search_path = public;
