
CREATE TABLE public.ad_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  company TEXT,
  website TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('text','image','video')),
  objective TEXT,
  header TEXT NOT NULL,
  description TEXT,
  body TEXT,
  cta_type TEXT,
  cta_url TEXT,
  cta_whatsapp TEXT,
  duration_days INTEGER,
  daily_budget_usd NUMERIC(12,2),
  total_budget_usd NUMERIC(12,2),
  countries TEXT[] DEFAULT ARRAY[]::TEXT[],
  cities TEXT[] DEFAULT ARRAY[]::TEXT[],
  demographics JSONB DEFAULT '{}'::JSONB,
  image_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
  video_path TEXT,
  video_url TEXT,
  notes TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','awaiting_funds','active','rejected','archived')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ad_inquiries TO authenticated;
GRANT ALL ON public.ad_inquiries TO service_role;

ALTER TABLE public.ad_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own inquiries read" ON public.ad_inquiries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "self insert inquiries" ON public.ad_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin update inquiries" ON public.ad_inquiries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ad_inquiries_updated_at
  BEFORE UPDATE ON public.ad_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ad_inquiries_status_idx ON public.ad_inquiries (status, created_at DESC);
CREATE INDEX ad_inquiries_user_idx ON public.ad_inquiries (user_id, created_at DESC);
