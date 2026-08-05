CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are publicly readable"
  ON public.product_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can add their own review"
  ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY "Users can update their own review"
  ON public.product_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review"
  ON public.product_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recalc_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid uuid; _avg numeric; _cnt integer;
BEGIN
  _pid := COALESCE(NEW.product_id, OLD.product_id);
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*) INTO _avg, _cnt
    FROM public.product_reviews WHERE product_id = _pid;
  UPDATE public.products
     SET rating = COALESCE(_avg, 0), reviews = COALESCE(_cnt, 0)
   WHERE id = _pid;
  RETURN NULL;
END; $$;

CREATE TRIGGER product_reviews_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalc_product_rating();

CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id);