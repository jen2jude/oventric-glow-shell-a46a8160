CREATE OR REPLACE FUNCTION public.has_any_management_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role,'moderator'::app_role,'finance'::app_role,'content'::app_role,'support'::app_role)
  );
$$;

DROP POLICY IF EXISTS "admins can read all user_roles" ON public.user_roles;
CREATE POLICY "admins can read all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));