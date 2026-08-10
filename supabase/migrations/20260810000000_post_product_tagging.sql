-- Create linking table for post media tagging
CREATE TABLE public.post_media_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    media_index integer NOT NULL DEFAULT 0, -- Which image in media_paths (0-based)
    x_percent numeric(5,2), -- Relative position for hotspots
    y_percent numeric(5,2),
    created_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookup by post
CREATE INDEX post_media_tags_post_id_idx ON public.post_media_tags(post_id);

-- RLS
ALTER TABLE public.post_media_tags ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.post_media_tags TO anon, authenticated;
GRANT INSERT, DELETE ON public.post_media_tags TO authenticated;
GRANT ALL ON public.post_media_tags TO service_role;

-- Policies: anyone who can see the post can see the tags
CREATE POLICY "Tags are viewable by post audience" ON public.post_media_tags
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id)
    );

-- Authors can manage tags
CREATE POLICY "Authors can manage tags" ON public.post_media_tags
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

