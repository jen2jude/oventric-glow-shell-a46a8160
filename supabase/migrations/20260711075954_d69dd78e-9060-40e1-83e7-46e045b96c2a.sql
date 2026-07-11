
-- Direct message → recipient notification
CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO _name FROM public.profiles WHERE user_id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    COALESCE(_name, 'New message') || ' sent you a message',
    LEFT(COALESCE(NEW.body, '📎 Attachment'), 140),
    NEW.sender_id
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();

-- Circle requests → target/requester notifications
CREATE OR REPLACE FUNCTION public.notify_on_circle_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target UUID; _rname TEXT; _tname TEXT;
BEGIN
  SELECT user_id INTO _target FROM public.profiles WHERE slug = NEW.target_slug;
  SELECT COALESCE(display_name, username, 'Someone') INTO _rname FROM public.profiles WHERE user_id = NEW.requester_id;

  IF TG_OP = 'INSERT' AND _target IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (_target, 'circle_request',
      COALESCE(_rname,'Someone') || ' wants to join your circle',
      'Open your circle inbox to accept or decline.',
      NEW.requester_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT COALESCE(display_name, username, 'A peer') INTO _tname FROM public.profiles WHERE user_id = _target;
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (NEW.requester_id, 'circle_accepted',
      COALESCE(_tname,'A peer') || ' accepted your circle request',
      'You are now in their circle.',
      _target);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_circle_request_ins ON public.circle_requests;
CREATE TRIGGER trg_notify_circle_request_ins AFTER INSERT ON public.circle_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_circle_request();
DROP TRIGGER IF EXISTS trg_notify_circle_request_upd ON public.circle_requests;
CREATE TRIGGER trg_notify_circle_request_upd AFTER UPDATE ON public.circle_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_circle_request();

-- Orders → buyer & seller
CREATE OR REPLACE FUNCTION public.notify_on_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _fire BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status IN ('paid','completed') THEN _fire := TRUE;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('paid','completed') AND OLD.status IS DISTINCT FROM NEW.status THEN _fire := TRUE;
  END IF;
  IF _fire THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.buyer_id, 'order_payment',
      'Order confirmed',
      'Your payment was received. Total $' || NEW.total_usd::TEXT,
      '/order/' || NEW.id);
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.seller_id, 'order_sale',
      'New sale',
      'You received a new order. Total $' || NEW.total_usd::TEXT,
      '/order/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_order_ins ON public.orders;
CREATE TRIGGER trg_notify_order_ins AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_on_order();
DROP TRIGGER IF EXISTS trg_notify_order_upd ON public.orders;
CREATE TRIGGER trg_notify_order_upd AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_on_order();

-- Payout status → user
CREATE OR REPLACE FUNCTION public.notify_on_payout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'payout_request',
      'Payout request submitted',
      NEW.currency || ' ' || NEW.amount::TEXT || ' pending review');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'payout_' || NEW.status,
      'Payout ' || NEW.status,
      CASE
        WHEN NEW.status = 'paid' THEN NEW.currency || ' ' || NEW.amount::TEXT || ' has been paid.'
        WHEN NEW.status = 'rejected' THEN 'Reason: ' || COALESCE(NEW.reject_reason,'—')
        ELSE 'Status updated to ' || NEW.status
      END);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_payout_ins ON public.payout_requests;
CREATE TRIGGER trg_notify_payout_ins AFTER INSERT ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_payout();
DROP TRIGGER IF EXISTS trg_notify_payout_upd ON public.payout_requests;
CREATE TRIGGER trg_notify_payout_upd AFTER UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_payout();

-- Bounty status → poster
CREATE OR REPLACE FUNCTION public.notify_on_bounty()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.poster_id, 'bounty_' || NEW.status,
      'Bounty ' || NEW.status,
      NEW.title,
      NULL);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_bounty_upd ON public.bounties;
CREATE TRIGGER trg_notify_bounty_upd AFTER UPDATE ON public.bounties
FOR EACH ROW EXECUTE FUNCTION public.notify_on_bounty();
