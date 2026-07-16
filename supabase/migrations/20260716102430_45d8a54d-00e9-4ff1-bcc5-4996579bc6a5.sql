GRANT SELECT (user_id, slug, display_name, username, bio, avatar_path, cover_path, verification_tier, reputation_stars, created_at) ON public.profiles TO anon;
GRANT SELECT (user_id, slug, display_name, username, bio, avatar_path, cover_path, verification_tier, reputation_stars, created_at) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, username, bio, avatar_path, cover_path, phone, country, address, notification_preferences) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;