-- Allow campaign owners (advertiser_user_id) to view their own campaign, creatives, events, spend, and leads (read-only).

CREATE POLICY "Owners can read own campaigns"
  ON public.ad_campaigns FOR SELECT TO authenticated
  USING (advertiser_user_id = auth.uid());

CREATE POLICY "Owners can read own creatives"
  ON public.ad_creatives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = ad_creatives.campaign_id AND c.advertiser_user_id = auth.uid()));

CREATE POLICY "Owners can read own events"
  ON public.ad_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = ad_events.campaign_id AND c.advertiser_user_id = auth.uid()));

CREATE POLICY "Owners can read own spend"
  ON public.ad_daily_spend FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = ad_daily_spend.campaign_id AND c.advertiser_user_id = auth.uid()));

CREATE POLICY "Owners can read own leads"
  ON public.ad_leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = ad_leads.campaign_id AND c.advertiser_user_id = auth.uid()));
