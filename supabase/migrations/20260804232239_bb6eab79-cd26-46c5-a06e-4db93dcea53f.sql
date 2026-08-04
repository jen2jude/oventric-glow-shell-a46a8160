CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name TEXT;
BEGIN
  IF NEW.recipient_id IS NULL OR NEW.recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, username, 'Someone') INTO _name FROM public.profiles WHERE user_id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    COALESCE(_name, 'Someone') || ' sent you a message',
    LEFT(COALESCE(NEW.body, '📎 Attachment'), 140),
    '/messages',
    NEW.sender_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_on_direct_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();