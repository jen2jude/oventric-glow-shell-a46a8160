DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'post_product_attachments') THEN
        CREATE TABLE public.post_product_attachments (
            id uuid primary key default gen_random_uuid(),
            post_id uuid references public.posts(id) on delete cascade not null,
            product_id uuid references public.products(id) on delete cascade not null,
            created_at timestamptz default now() not null,
            unique(post_id, product_id)
        );

        GRANT SELECT, INSERT, DELETE ON public.post_product_attachments TO authenticated;
        GRANT ALL ON public.post_product_attachments TO service_role;

        ALTER TABLE public.post_product_attachments ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Anyone can select attachments"
        ON public.post_product_attachments FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Authors can manage their own post attachments"
        ON public.post_product_attachments FOR ALL
        TO authenticated
        USING (
            exists (
                select 1 from public.posts
                where id = post_id
                  and author_id = auth.uid()
            )
        );
    END IF;
END $$;