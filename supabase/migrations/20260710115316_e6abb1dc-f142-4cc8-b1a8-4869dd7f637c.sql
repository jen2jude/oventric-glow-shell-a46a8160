
CREATE OR REPLACE FUNCTION public.profile_social_counts(_slug text)
RETURNS TABLE(followers bigint, circle_members bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.circle_requests WHERE target_slug = _slug)::bigint AS followers,
    (SELECT count(*) FROM public.circle_requests WHERE target_slug = _slug AND status = 'accepted')::bigint AS circle_members
$$;

REVOKE ALL ON FUNCTION public.profile_social_counts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_social_counts(text) TO anon, authenticated;
