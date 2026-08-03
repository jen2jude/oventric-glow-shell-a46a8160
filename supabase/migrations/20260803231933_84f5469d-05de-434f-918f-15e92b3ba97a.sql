CREATE TYPE public.photo_batch_status AS ENUM ('queued','uploading','ready','failed');

CREATE TABLE public.photo_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  status public.photo_batch_status NOT NULL DEFAULT 'queued',
  expected_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.photo_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.photo_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  file_name text,
  size_bytes bigint,
  status public.photo_batch_status NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX photo_batches_user_created_idx ON public.photo_batches (user_id, created_at DESC);
CREATE INDEX photo_batch_items_batch_idx ON public.photo_batch_items (batch_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_batches TO authenticated;
GRANT ALL ON public.photo_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_batch_items TO authenticated;
GRANT ALL ON public.photo_batch_items TO service_role;

ALTER TABLE public.photo_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own batches" ON public.photo_batches FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own batch items" ON public.photo_batch_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER photo_batches_updated_at BEFORE UPDATE ON public.photo_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER photo_batch_items_updated_at BEFORE UPDATE ON public.photo_batch_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "user photos read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user photos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user photos update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user photos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-photos' AND (storage.foldername(name))[1] = auth.uid()::text);