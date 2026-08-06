-- PostgREST needs an explicit relationship to join tables.
-- The profiles table uses user_id as its primary key (or at least its identifier).
-- We'll add a foreign key from product_reviews.user_id to profiles.user_id.

ALTER TABLE public.product_reviews
DROP CONSTRAINT IF EXISTS product_reviews_user_id_profiles_fkey;

ALTER TABLE public.product_reviews
ADD CONSTRAINT product_reviews_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Ensure permissions are solid
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
