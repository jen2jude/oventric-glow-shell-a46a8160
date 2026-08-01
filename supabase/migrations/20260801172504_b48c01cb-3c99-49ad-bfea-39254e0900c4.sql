DROP FUNCTION IF EXISTS public.profile_social_counts(text);

CREATE OR REPLACE FUNCTION public.profile_social_counts(_slug text)
RETURNS TABLE(followers bigint, following bigint, circle_members bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT user_id FROM public.profiles WHERE slug = _slug LIMIT 1
  )
  SELECT
    (SELECT count(*) FROM public.follows f, target t WHERE f.followee_id = t.user_id)::bigint AS followers,
    (SELECT count(*) FROM public.follows f, target t WHERE f.follower_id = t.user_id)::bigint AS following,
    (SELECT count(*) FROM public.circle_members cm, target t WHERE cm.user_id = t.user_id)::bigint AS circle_members
$function$;

GRANT EXECUTE ON FUNCTION public.profile_social_counts(text) TO anon, authenticated, service_role;