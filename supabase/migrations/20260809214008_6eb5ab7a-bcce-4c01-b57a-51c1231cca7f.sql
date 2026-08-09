CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  media_path text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX stories_user_idx ON public.stories(user_id, created_at DESC);
CREATE INDEX stories_expires_idx ON public.stories(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_live" ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now());
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_views_insert_own" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());
CREATE POLICY "story_views_select" ON public.story_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()));

CREATE POLICY "story_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "story_media_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'story-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "story_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'story-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.purge_expired_stories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  WITH gone AS (DELETE FROM public.stories WHERE expires_at <= now() RETURNING 1)
  SELECT count(*) INTO _n FROM gone;
  RETURN _n;
END;
$$;