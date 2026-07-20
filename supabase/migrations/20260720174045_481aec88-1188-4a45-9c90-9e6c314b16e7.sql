
REVOKE ALL ON FUNCTION public.bounty_publish_lock(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bounty_publish_lock(uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.bounty_release_escrow(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bounty_refund_escrow(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bounty_auto_release_due() FROM PUBLIC, anon, authenticated;
