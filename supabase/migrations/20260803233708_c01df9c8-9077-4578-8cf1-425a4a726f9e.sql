CREATE TABLE public.bounty_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  solver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  timeline text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, solver_id)
);

GRANT SELECT, INSERT, UPDATE ON public.bounty_submissions TO authenticated;
GRANT ALL ON public.bounty_submissions TO service_role;

ALTER TABLE public.bounty_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solver can insert own submission"
ON public.bounty_submissions FOR INSERT TO authenticated
WITH CHECK (
  solver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bounties b
    WHERE b.id = bounty_id AND b.accepted_applicant_id = auth.uid()
  )
);

CREATE POLICY "Solver can update own submission"
ON public.bounty_submissions FOR UPDATE TO authenticated
USING (solver_id = auth.uid())
WITH CHECK (solver_id = auth.uid());

CREATE POLICY "Solver poster and admins can view submission"
ON public.bounty_submissions FOR SELECT TO authenticated
USING (
  solver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.bounties b
    WHERE b.id = bounty_id AND b.poster_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_bounty_submissions_updated_at
BEFORE UPDATE ON public.bounty_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();