
CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  signature TEXT PRIMARY KEY,
  event TEXT,
  reference TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.paystack_webhook_events TO service_role;
ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.paystack_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS paystack_webhook_events_received_at_idx
  ON public.paystack_webhook_events (received_at DESC);
