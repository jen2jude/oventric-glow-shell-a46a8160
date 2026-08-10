CREATE TABLE IF NOT EXISTS public.post_media_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_index integer NOT NULL DEFAULT 0,
  x_percent numeric(5,2),
  y_percent numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_media_tags_post_id_idx ON public.post_media_tags(post_id);

GRANT SELECT ON public.post_media_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media_tags TO authenticated;
GRANT ALL ON public.post_media_tags TO service_role;

ALTER TABLE public.post_media_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product tags"
ON public.post_media_tags FOR SELECT
USING (true);

CREATE POLICY "Post authors manage their tags"
ON public.post_media_tags FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));