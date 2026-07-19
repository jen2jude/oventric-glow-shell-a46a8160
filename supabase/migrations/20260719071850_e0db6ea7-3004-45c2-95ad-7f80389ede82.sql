-- Authenticated users need full row access; RLS still scopes writes to own row.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Anon can only read safe public columns.
GRANT SELECT (
  user_id, slug, username, display_name, bio, avatar_path, cover_path,
  verification_tier, reputation_stars, country,
  created_at, updated_at, deleted_at
) ON public.profiles TO anon;

GRANT ALL ON public.profiles TO service_role;