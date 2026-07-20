
-- Extend ad_campaigns
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS advertiser_email text,
  ADD COLUMN IF NOT EXISTS advertiser_whatsapp text,
  ADD COLUMN IF NOT EXISTS advertiser_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cta_whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_lead_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS cities text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS daily_budget_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_budget_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escrow_locked numeric NOT NULL DEFAULT 0;

-- Widen cta_type to allow whatsapp / lead_form / url; drop old check if any
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'ad_campaigns_cta_type_check') THEN
    ALTER TABLE public.ad_campaigns DROP CONSTRAINT ad_campaigns_cta_type_check;
  END IF;
END $$;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_cta_type_check CHECK (cta_type IN ('url','whatsapp','lead_form'));

-- Creatives
CREATE TABLE IF NOT EXISTS public.ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  path text NOT NULL,
  mime text,
  width integer,
  height integer,
  duration_s numeric,
  bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_creatives TO authenticated;
GRANT ALL ON public.ad_creatives TO service_role;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage creatives" ON public.ad_creatives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign ON public.ad_creatives(campaign_id, sort_order);

-- Cities dictionary
CREATE TABLE IF NOT EXISTS public.ad_targets_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  city text NOT NULL,
  region text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, city)
);
GRANT SELECT ON public.ad_targets_cities TO anon, authenticated;
GRANT ALL ON public.ad_targets_cities TO service_role;
ALTER TABLE public.ad_targets_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read cities" ON public.ad_targets_cities FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admin manage cities" ON public.ad_targets_cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.ad_targets_cities (country_code, city, sort_order) VALUES
  ('NG','Lagos',1),('NG','Abuja',2),('NG','Kano',3),('NG','Ibadan',4),('NG','Port Harcourt',5),
  ('NG','Benin City',6),('NG','Kaduna',7),('NG','Enugu',8),('NG','Warri',9),('NG','Uyo',10),
  ('NG','Owerri',11),('NG','Jos',12),('NG','Ilorin',13),('NG','Abeokuta',14),('NG','Calabar',15),
  ('GH','Accra',1),('GH','Kumasi',2),('GH','Takoradi',3),('GH','Tamale',4),('GH','Cape Coast',5),
  ('GH','Sunyani',6),('GH','Ho',7),('GH','Koforidua',8),('GH','Tema',9)
ON CONFLICT (country_code, city) DO NOTHING;

-- Events
CREATE TABLE IF NOT EXISTS public.ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('impression','click','lead')),
  user_id uuid,
  session_id text,
  placement text,
  country text,
  city text,
  cost_usd numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_events TO service_role;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read events" ON public.ad_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ad_events_campaign_time ON public.ad_events(campaign_id, occurred_at DESC);

-- Leads
CREATE TABLE IF NOT EXISTS public.ad_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  digest_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_leads TO authenticated;
GRANT ALL ON public.ad_leads TO service_role;
ALTER TABLE public.ad_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read leads" ON public.ad_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- Daily spend rollup
CREATE TABLE IF NOT EXISTS public.ad_daily_spend (
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  day date NOT NULL,
  spent_usd numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);
GRANT SELECT ON public.ad_daily_spend TO authenticated;
GRANT ALL ON public.ad_daily_spend TO service_role;
ALTER TABLE public.ad_daily_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read spend" ON public.ad_daily_spend FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- Pricing per tier (unit USD)
CREATE OR REPLACE FUNCTION public.ad_price_per_event(_tier text, _kind text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _kind
    WHEN 'impression' THEN
      CASE _tier WHEN 'text' THEN 0.0005 WHEN 'image' THEN 0.002 WHEN 'video' THEN 0.006 ELSE 0.001 END
    WHEN 'click' THEN
      CASE _tier WHEN 'text' THEN 0.0025 WHEN 'image' THEN 0.01 WHEN 'video' THEN 0.03 ELSE 0.005 END
    ELSE 0 END;
$$;

-- Serving list RPC (public, filtered)
CREATE OR REPLACE FUNCTION public.list_serving_ads(_placement text, _country text DEFAULT NULL, _city text DEFAULT NULL, _limit integer DEFAULT 5)
RETURNS TABLE (
  id uuid, tier text, header text, description text, body text,
  cta_type text, cta_label text, cta_url text, cta_whatsapp text,
  priority integer,
  creatives jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.tier, c.header, c.description, c.body,
         c.cta_type, c.cta_label, c.cta_url, c.cta_whatsapp,
         c.priority,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id',cr.id,'kind',cr.kind,'path',cr.path,'sort_order',cr.sort_order) ORDER BY cr.sort_order)
           FROM public.ad_creatives cr WHERE cr.campaign_id = c.id
         ), '[]'::jsonb) AS creatives
  FROM public.ad_campaigns c
  LEFT JOIN public.ad_daily_spend ds ON ds.campaign_id = c.id AND ds.day = (now() AT TIME ZONE 'utc')::date
  WHERE c.status = 'active'
    AND _placement = ANY(c.placements)
    AND (c.start_at IS NULL OR c.start_at <= now())
    AND (c.end_at IS NULL OR c.end_at >= now())
    AND (c.total_budget_usd = 0 OR c.spent_usd < c.total_budget_usd)
    AND (c.daily_budget_usd = 0 OR COALESCE(ds.spent_usd,0) < c.daily_budget_usd)
    AND (cardinality(c.countries) = 0 OR _country IS NULL OR _country = ANY(c.countries))
    AND (cardinality(c.cities) = 0 OR _city IS NULL OR _city = ANY(c.cities))
  ORDER BY c.priority DESC, c.created_at DESC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.list_serving_ads(text,text,text,integer) TO anon, authenticated;

-- Log event RPC
CREATE OR REPLACE FUNCTION public.log_ad_event(_campaign_id uuid, _kind text, _placement text, _country text, _city text, _session text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tier text; _cost numeric; _today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF _kind NOT IN ('impression','click') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  SELECT tier INTO _tier FROM public.ad_campaigns WHERE id = _campaign_id AND status = 'active';
  IF _tier IS NULL THEN RETURN; END IF;
  _cost := public.ad_price_per_event(_tier, _kind);
  INSERT INTO public.ad_events(campaign_id,kind,user_id,session_id,placement,country,city,cost_usd)
    VALUES (_campaign_id,_kind,auth.uid(),_session,_placement,_country,_city,_cost);
  INSERT INTO public.ad_daily_spend(campaign_id,day,spent_usd,impressions,clicks)
    VALUES (_campaign_id,_today,_cost, CASE WHEN _kind='impression' THEN 1 ELSE 0 END, CASE WHEN _kind='click' THEN 1 ELSE 0 END)
    ON CONFLICT (campaign_id,day) DO UPDATE
      SET spent_usd = public.ad_daily_spend.spent_usd + EXCLUDED.spent_usd,
          impressions = public.ad_daily_spend.impressions + EXCLUDED.impressions,
          clicks = public.ad_daily_spend.clicks + EXCLUDED.clicks;
  UPDATE public.ad_campaigns SET spent_usd = spent_usd + _cost, updated_at = now() WHERE id = _campaign_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.log_ad_event(uuid,text,text,text,text,text) TO anon, authenticated;

-- Submit lead RPC
CREATE OR REPLACE FUNCTION public.submit_ad_lead(_campaign_id uuid, _name text, _email text, _phone text, _message text, _meta jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ad_campaigns WHERE id = _campaign_id AND status = 'active') THEN
    RAISE EXCEPTION 'campaign not active';
  END IF;
  IF _email IS NULL OR position('@' in _email) < 2 THEN RAISE EXCEPTION 'invalid email'; END IF;
  INSERT INTO public.ad_leads(campaign_id,name,email,phone,message,meta)
    VALUES (_campaign_id, NULLIF(_name,''), lower(_email), NULLIF(_phone,''), NULLIF(_message,''), COALESCE(_meta,'{}'::jsonb))
    RETURNING id INTO _id;
  INSERT INTO public.ad_events(campaign_id,kind,placement,cost_usd) VALUES (_campaign_id,'lead','lead_form',0);
  INSERT INTO public.ad_daily_spend(campaign_id,day,leads) VALUES (_campaign_id,_today,1)
    ON CONFLICT (campaign_id,day) DO UPDATE SET leads = public.ad_daily_spend.leads + 1;
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_ad_lead(uuid,text,text,text,text,jsonb) TO anon, authenticated;

-- Activate / pause / end with wallet escrow
CREATE OR REPLACE FUNCTION public.activate_campaign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.ad_campaigns; _uid uuid; _bal numeric; _need numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _c FROM public.ad_campaigns WHERE id = _id FOR UPDATE;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _c.status = 'active' THEN RETURN; END IF;
  _uid := COALESCE(_c.advertiser_user_id, _c.created_by);
  _need := GREATEST(_c.total_budget_usd - _c.escrow_locked - _c.spent_usd, 0);
  IF _uid IS NOT NULL AND _need > 0 THEN
    SELECT available_balance INTO _bal FROM public.wallets WHERE user_id = _uid AND currency='USD' FOR UPDATE;
    IF COALESCE(_bal,0) < _need THEN RAISE EXCEPTION 'insufficient wallet balance ($%)', _need; END IF;
    UPDATE public.wallets SET available_balance = available_balance - _need,
                              escrow_balance = escrow_balance + _need,
                              updated_at = now()
      WHERE user_id = _uid AND currency='USD';
    INSERT INTO public.wallet_transactions(user_id,tx_hash,type,amount,currency,inflow,status,occurred_at)
      VALUES (_uid,'CMP-'||substr(_id::text,1,8),'Campaign Escrow',_need,'USD',false,'success',now());
    UPDATE public.ad_campaigns SET escrow_locked = escrow_locked + _need WHERE id = _id;
  END IF;
  UPDATE public.ad_campaigns SET status='active', updated_at=now() WHERE id = _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.activate_campaign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pause_campaign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ad_campaigns SET status='paused', updated_at=now() WHERE id = _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.pause_campaign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_campaign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.ad_campaigns; _refund numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _c FROM public.ad_campaigns WHERE id = _id FOR UPDATE;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  _refund := GREATEST(_c.escrow_locked - _c.spent_usd, 0);
  IF _refund > 0 AND _c.advertiser_user_id IS NOT NULL THEN
    UPDATE public.wallets SET escrow_balance = GREATEST(escrow_balance - _refund, 0),
                              available_balance = available_balance + _refund,
                              updated_at = now()
      WHERE user_id = _c.advertiser_user_id AND currency='USD';
    INSERT INTO public.wallet_transactions(user_id,tx_hash,type,amount,currency,inflow,status,occurred_at)
      VALUES (_c.advertiser_user_id,'CMP-'||substr(_id::text,1,8)||'-R','Campaign Refund',_refund,'USD',true,'success',now());
    UPDATE public.ad_campaigns SET escrow_locked = GREATEST(escrow_locked - _refund, 0) WHERE id = _id;
  END IF;
  IF _c.spent_usd > 0 THEN
    PERFORM public.system_wallet_credit('ads', _c.spent_usd, 'campaign_settle', _id, '{}'::jsonb);
  END IF;
  UPDATE public.ad_campaigns SET status='ended', updated_at=now() WHERE id = _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.end_campaign(uuid) TO authenticated;

-- Ensure ads system wallet exists
INSERT INTO public.system_wallets(kind, balance_usd) VALUES ('ads', 0) ON CONFLICT (kind) DO NOTHING;
