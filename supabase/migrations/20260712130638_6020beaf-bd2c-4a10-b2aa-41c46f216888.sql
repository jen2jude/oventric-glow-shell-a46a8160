-- Restore EXECUTE on has_role for anon so RLS policies referencing it evaluate for
-- anonymous callers on public reads (e.g., listing published courses). has_role is
-- SECURITY DEFINER and only reads public.user_roles by user_id — no privilege
-- escalation.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;