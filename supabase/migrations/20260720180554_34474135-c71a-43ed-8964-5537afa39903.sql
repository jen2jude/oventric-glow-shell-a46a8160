
CREATE TABLE public.bounty_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bounty_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bounty_categories TO authenticated;
GRANT ALL ON public.bounty_categories TO service_role;

ALTER TABLE public.bounty_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bounty categories"
  ON public.bounty_categories FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert bounty categories"
  ON public.bounty_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update bounty categories"
  ON public.bounty_categories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bounty categories"
  ON public.bounty_categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bounty_categories_updated_at
  BEFORE UPDATE ON public.bounty_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bounty_categories (slug, label, sort_order) VALUES
  ('frontend', 'Frontend Gigs', 10),
  ('database', 'Database Ops', 20),
  ('api', 'API Integrations', 30),
  ('uiux', 'UI/UX Polishing', 40)
ON CONFLICT (slug) DO NOTHING;
