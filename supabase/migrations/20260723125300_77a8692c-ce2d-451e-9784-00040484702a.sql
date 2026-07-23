
-- Backfill profile rows for any auth.users missing one so admin dashboard
-- reflects every real signup. AuthSeeder handles this idempotently for
-- future users on their first session; this closes the historical gap.
INSERT INTO public.profiles (user_id, slug, username, display_name, verification_tier, reputation_stars)
SELECT
  u.id,
  'user' || substr(u.id::text, 1, 8),
  'user' || substr(u.id::text, 1, 8),
  COALESCE(split_part(u.email, '@', 1), ''),
  'TIER_0',
  0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Backfill USD wallet rows for any non-anonymous user missing one so their
-- balances and transaction history render in the admin detail view.
INSERT INTO public.wallets (user_id, currency, available_balance, escrow_balance, accumulated_cashback)
SELECT u.id, c.currency, 0, 0, 0
FROM auth.users u
CROSS JOIN (VALUES ('USD'),('NGN'),('GHS')) AS c(currency)
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.user_id = u.id AND w.currency = c.currency
  )
ON CONFLICT (user_id, currency) DO NOTHING;
