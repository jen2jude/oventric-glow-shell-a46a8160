ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dob_public boolean NOT NULL DEFAULT false;