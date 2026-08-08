ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_post_view(_post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = _post_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO anon, authenticated;