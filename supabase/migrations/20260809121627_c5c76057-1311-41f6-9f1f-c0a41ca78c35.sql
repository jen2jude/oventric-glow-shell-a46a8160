ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS shop_about text,
  ADD COLUMN IF NOT EXISTS shop_logo_path text,
  ADD COLUMN IF NOT EXISTS shop_cover_path text;