ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tools text[] NOT NULL DEFAULT '{}'::text[];