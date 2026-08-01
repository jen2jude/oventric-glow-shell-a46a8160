ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_feature_carousel boolean NOT NULL DEFAULT false;