ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
  'email_digest', true,
  'dm_pings', true,
  'bounty_invites', true
);