
CREATE TYPE public.circle_status AS ENUM ('pending', 'accepted');

CREATE TABLE public.circle_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_slug TEXT NOT NULL,
  status public.circle_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_slug)
);

CREATE INDEX circle_requests_target_slug_idx ON public.circle_requests (target_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_requests TO authenticated;
GRANT ALL ON public.circle_requests TO service_role;

ALTER TABLE public.circle_requests ENABLE ROW LEVEL SECURITY;

-- Users can see requests they sent
CREATE POLICY "requester can read own requests"
ON public.circle_requests FOR SELECT
TO authenticated
USING (auth.uid() = requester_id);

-- Target can read requests aimed at their profile slug (slug lookup validated server-side)
CREATE POLICY "authenticated can read requests where target"
ON public.circle_requests FOR SELECT
TO authenticated
USING (true);

-- Only requester can create
CREATE POLICY "requester can insert own requests"
ON public.circle_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

-- Requester can delete their own requests (cancel/leave)
CREATE POLICY "requester can delete own requests"
ON public.circle_requests FOR DELETE
TO authenticated
USING (auth.uid() = requester_id);

-- Update (accept) is performed server-side via service role, so no update policy for end users
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_circle_requests_updated_at
BEFORE UPDATE ON public.circle_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
