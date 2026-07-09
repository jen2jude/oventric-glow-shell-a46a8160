
CREATE TABLE public.bounties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'api',
  price_usd NUMERIC(12,2) NOT NULL CHECK (price_usd >= 0),
  cover_path TEXT,
  applicant_limit INT NOT NULL DEFAULT 10 CHECK (applicant_limit > 0),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed','draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bounties_status_created_idx ON public.bounties (status, created_at DESC);
CREATE INDEX bounties_poster_idx ON public.bounties (poster_id);

GRANT SELECT ON public.bounties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounties TO authenticated;
GRANT ALL ON public.bounties TO service_role;

ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bounties are viewable by anyone"
  ON public.bounties FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own bounties"
  ON public.bounties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Owners and admins can update bounties"
  ON public.bounties FOR UPDATE
  TO authenticated
  USING (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can delete bounties"
  ON public.bounties FOR DELETE
  TO authenticated
  USING (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bounties_updated_at
  BEFORE UPDATE ON public.bounties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can read bounty covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bounty-covers');

CREATE POLICY "Users can upload bounty covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bounty-covers'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Users update own bounty covers, admin any"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bounty-covers'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Users delete own bounty covers, admin any"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bounty-covers'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
  );
