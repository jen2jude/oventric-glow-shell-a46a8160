
CREATE TYPE public.report_reason AS ENUM ('spam', 'harassment', 'ip', 'scam');

CREATE TABLE public.post_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id TEXT NOT NULL,
  target_kind TEXT NOT NULL DEFAULT 'post',
  reason public.report_reason NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX post_reports_target_id_idx ON public.post_reports (target_id);

GRANT ALL ON public.post_reports TO service_role;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: writes go through a server function using service role.
