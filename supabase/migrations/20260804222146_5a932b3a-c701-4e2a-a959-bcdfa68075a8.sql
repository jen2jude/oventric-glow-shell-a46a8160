CREATE TABLE public.promo_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_id text NOT NULL,
  promo_title text,
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  surface text NOT NULL DEFAULT 'home',
  session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.promo_events TO anon;
GRANT INSERT, SELECT ON public.promo_events TO authenticated;
GRANT ALL ON public.promo_events TO service_role;

ALTER TABLE public.promo_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record promo events"
  ON public.promo_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins can read promo events"
  ON public.promo_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_promo_events_promo_kind ON public.promo_events (promo_id, kind, created_at DESC);