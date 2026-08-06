CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  topic text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
ON public.notification_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notif_topic_for_kind(_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _kind = 'direct_message' THEN 'messages'
    WHEN _kind LIKE 'bounty%' THEN 'bounties'
    WHEN _kind LIKE 'post%' OR _kind LIKE 'comment%' OR _kind LIKE 'like%'
      OR _kind LIKE 'follow%' OR _kind LIKE 'circle%' THEN 'posts'
    WHEN _kind LIKE 'order%' OR _kind LIKE 'product%' OR _kind LIKE 'sale%'
      OR _kind LIKE 'dispute%' THEN 'marketplace'
    WHEN _kind LIKE 'payout%' OR _kind LIKE 'wallet%' OR _kind LIKE 'cashback%' THEN 'wallet'
    WHEN _kind LIKE 'course%' OR _kind LIKE 'academy%' OR _kind LIKE 'enrol%' THEN 'academy'
    ELSE 'system'
  END
$$;