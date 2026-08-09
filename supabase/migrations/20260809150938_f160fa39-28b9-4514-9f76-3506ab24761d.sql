ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[];