ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS repost_of uuid REFERENCES public.posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS posts_repost_of_idx ON public.posts (repost_of);