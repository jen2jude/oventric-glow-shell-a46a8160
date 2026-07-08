
-- profiles table
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "user can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: caller's slug
CREATE OR REPLACE FUNCTION public.current_user_slug()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT slug FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Recipient-side policies on circle_requests
CREATE POLICY "target can update requests"
  ON public.circle_requests FOR UPDATE TO authenticated
  USING (target_slug = public.current_user_slug())
  WITH CHECK (target_slug = public.current_user_slug());

CREATE POLICY "target can delete requests"
  ON public.circle_requests FOR DELETE TO authenticated
  USING (target_slug = public.current_user_slug());
