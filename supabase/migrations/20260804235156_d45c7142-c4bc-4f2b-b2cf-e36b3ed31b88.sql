CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  is_staff boolean;
  n_kind text;
BEGIN
  SELECT public.has_any_management_role(NEW.sender_id) INTO is_staff;

  -- Peer-to-peer chat stays in the chat icon only; the bell is reserved for
  -- order-linked conversations and staff/system messages.
  IF NEW.order_id IS NULL AND NOT COALESCE(is_staff, false) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  n_kind := CASE WHEN NEW.order_id IS NOT NULL THEN 'order_message' ELSE 'direct_message' END;

  INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
  VALUES (
    NEW.recipient_id,
    n_kind,
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    LEFT(COALESCE(NEW.body, ''), 140),
    '/?section=Messages&dm=' || NEW.sender_id::text,
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

DELETE FROM public.notifications n
WHERE n.kind = 'direct_message'
  AND n.from_user_id IS NOT NULL
  AND NOT public.has_any_management_role(n.from_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.sender_id = n.from_user_id
      AND dm.recipient_id = n.user_id
      AND dm.order_id IS NOT NULL
  );