-- Migration to support direct product attachments to posts

CREATE TABLE IF NOT EXISTS public.post_product_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, product_id)
);

-- Grants
GRANT SELECT, INSERT, DELETE ON public.post_product_attachments TO authenticated;
GRANT ALL ON public.post_product_attachments TO service_role;
GRANT SELECT ON public.post_product_attachments TO anon;

-- RLS
ALTER TABLE public.post_product_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attachments"
ON public.post_product_attachments FOR SELECT
TO public
USING (true);

CREATE POLICY "Authors can manage attachments"
ON public.post_product_attachments FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE id = post_id AND author_id = auth.uid()
    )
);
