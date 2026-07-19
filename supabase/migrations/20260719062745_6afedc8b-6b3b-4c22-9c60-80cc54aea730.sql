
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_liveness_path TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles (deleted_at) WHERE deleted_at IS NOT NULL;

-- Extensions for cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daily purge job at 03:00 UTC. Calls the public purge endpoint which
-- verifies the caller and hard-deletes auth users past the 30-day window.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-soft-deleted-accounts') THEN
    PERFORM cron.unschedule('purge-soft-deleted-accounts');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-soft-deleted-accounts',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--edfe3718-716a-4c70-9e5e-216fbc715fe1.lovable.app/api/public/hooks/purge-deleted-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_O3052FGikKA6ZhtrJYxx0w_EDjxLtJO'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
