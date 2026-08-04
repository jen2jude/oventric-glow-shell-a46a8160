CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone')
    INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    LEFT(COALESCE(NEW.body, ''), 140),
    '/?section=Messages&dm=' || NEW.sender_id::text,
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

UPDATE public.notifications n
SET link = '/?section=Messages&dm=' || n.from_user_id::text
WHERE n.kind = 'direct_message'
  AND n.from_user_id IS NOT NULL
  AND (n.link IS NULL OR n.link = '/messages');

UPDATE public.notifications
SET link = '/?section=Messages'
WHERE kind = 'direct_message' AND link = '/messages';