ALTER TABLE public.products ALTER COLUMN rating SET DEFAULT 0;
UPDATE public.products SET rating = 0 WHERE COALESCE(reviews,0) = 0 AND rating <> 0;