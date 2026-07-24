
CREATE TABLE public.affiliate_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  country TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.affiliate_reservations TO authenticated;
GRANT ALL ON public.affiliate_reservations TO service_role;

ALTER TABLE public.affiliate_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reservation"
  ON public.affiliate_reservations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own reservation"
  ON public.affiliate_reservations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all reservations"
  ON public.affiliate_reservations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_affiliate_reservations_updated_at
  BEFORE UPDATE ON public.affiliate_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_affiliate_reservations_created_at ON public.affiliate_reservations(created_at DESC);
