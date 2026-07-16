
ALTER TABLE public.profiles ALTER COLUMN reputation_stars SET DEFAULT 0;
UPDATE public.profiles SET reputation_stars = 0 WHERE reputation_stars <> 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Admins read all user_roles'
  ) THEN
    CREATE POLICY "Admins read all user_roles" ON public.user_roles
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;
