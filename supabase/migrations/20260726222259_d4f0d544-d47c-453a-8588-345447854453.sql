
-- 1) Cover image column on circles
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS cover_url text;

-- 2) circle_categories table
CREATE TABLE IF NOT EXISTS public.circle_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.circle_categories TO anon, authenticated;
GRANT ALL ON public.circle_categories TO service_role;

ALTER TABLE public.circle_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circle_categories_public_read" ON public.circle_categories;
CREATE POLICY "circle_categories_public_read" ON public.circle_categories
  FOR SELECT TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS "circle_categories_admin_all" ON public.circle_categories;
CREATE POLICY "circle_categories_admin_all" ON public.circle_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reuse project updated_at helper (present in schema)
DROP TRIGGER IF EXISTS trg_circle_categories_updated_at ON public.circle_categories;
CREATE TRIGGER trg_circle_categories_updated_at
  BEFORE UPDATE ON public.circle_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.circle_categories (slug, name, sort_order) VALUES
  ('saas-builders', 'SaaS Builders', 10),
  ('ai-engineering', 'AI Engineering', 20),
  ('design-systems', 'Design Systems', 30),
  ('web3-crypto', 'Web3/Crypto', 40),
  ('mobile-apps', 'Mobile Apps', 50),
  ('infra-devops', 'Infra & DevOps', 60),
  ('community', 'Community', 70)
ON CONFLICT (slug) DO NOTHING;
