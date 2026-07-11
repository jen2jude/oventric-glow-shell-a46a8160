
-- =========================================================
-- CIRCLES (groups)
-- =========================================================
CREATE TABLE public.circles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,80}$'),
  description TEXT,
  avatar_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circles TO authenticated;
GRANT ALL ON public.circles TO service_role;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.circle_members (
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);
CREATE INDEX idx_circle_members_user ON public.circle_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_members TO authenticated;
GRANT ALL ON public.circle_members TO service_role;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.circle_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (circle_id, requester_id)
);
CREATE INDEX idx_cjr_circle_status ON public.circle_join_requests(circle_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_join_requests TO authenticated;
GRANT ALL ON public.circle_join_requests TO service_role;
ALTER TABLE public.circle_join_requests ENABLE ROW LEVEL SECURITY;

-- Helper: is user an admin/owner of a circle? (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_circle_admin(_user_id UUID, _circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = _circle_id AND user_id = _user_id AND role IN ('owner','admin')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_circle_admin(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_circle_admin(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_circle_member(_user_id UUID, _circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = _circle_id AND user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_circle_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_circle_member(UUID, UUID) TO authenticated, service_role;

-- Policies: circles
CREATE POLICY "circles_read_public_or_member" ON public.circles
  FOR SELECT TO authenticated
  USING (is_private = false OR public.is_circle_member(auth.uid(), id));

CREATE POLICY "circles_insert_owner" ON public.circles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "circles_update_owner" ON public.circles
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "circles_delete_owner" ON public.circles
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Policies: circle_members
CREATE POLICY "cm_read_visible" ON public.circle_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = circle_members.circle_id
        AND (c.is_private = false OR public.is_circle_member(auth.uid(), c.id))
    )
  );

-- Owner/admin can add members directly; users can insert their own row via server fn (accept request)
CREATE POLICY "cm_insert_admin_or_self" ON public.circle_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_circle_admin(auth.uid(), circle_id)
    OR auth.uid() = user_id
  );

CREATE POLICY "cm_delete_admin_or_self" ON public.circle_members
  FOR DELETE TO authenticated
  USING (
    public.is_circle_admin(auth.uid(), circle_id) OR auth.uid() = user_id
  );

-- Policies: circle_join_requests
CREATE POLICY "cjr_read_requester_or_admin" ON public.circle_join_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = requester_id OR public.is_circle_admin(auth.uid(), circle_id)
  );

CREATE POLICY "cjr_insert_requester" ON public.circle_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "cjr_update_admin" ON public.circle_join_requests
  FOR UPDATE TO authenticated
  USING (public.is_circle_admin(auth.uid(), circle_id))
  WITH CHECK (public.is_circle_admin(auth.uid(), circle_id));

CREATE POLICY "cjr_delete_requester_or_admin" ON public.circle_join_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR public.is_circle_admin(auth.uid(), circle_id));

-- =========================================================
-- FOLLOWS
-- =========================================================
CREATE TABLE public.follow_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id),
  CHECK (requester_id <> target_id)
);
CREATE INDEX idx_fr_target_status ON public.follow_requests(target_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_requests TO authenticated;
GRANT ALL ON public.follow_requests TO service_role;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX idx_follows_followee ON public.follows(followee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Policies: follow_requests — only the two parties can see them
CREATE POLICY "fr_read_parties" ON public.follow_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "fr_insert_requester" ON public.follow_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "fr_update_target" ON public.follow_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = target_id) WITH CHECK (auth.uid() = target_id);

CREATE POLICY "fr_delete_parties" ON public.follow_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Policies: follows — public read, only follower can unfollow, only target can accept (insert on their behalf via server fn)
CREATE POLICY "follows_read_all" ON public.follows
  FOR SELECT TO authenticated USING (true);

-- Insert path: either the follower inserts themselves (when target auto-accepts), or the target inserts (accept request).
CREATE POLICY "follows_insert_participant" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id OR auth.uid() = followee_id);

CREATE POLICY "follows_delete_participant" ON public.follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);

-- =========================================================
-- Triggers: updated_at
-- =========================================================
CREATE TRIGGER trg_circles_updated
  BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cjr_updated
  BEFORE UPDATE ON public.circle_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_fr_updated
  BEFORE UPDATE ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Auto-add owner as circle_members(owner) on circle create
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_owner_to_circle()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.circle_members (circle_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_owner_to_circle() FROM PUBLIC, anon;

CREATE TRIGGER trg_circle_owner_membership
  AFTER INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_to_circle();

-- =========================================================
-- Notification kinds: expand check constraint
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_kind_check') THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'circle_request','circle_accepted',
    'follow_request','follow_accepted',
    'circle_join_request','circle_join_accepted','circle_join_declined',
    'direct_message',
    'order_payment','order_sale',
    'payout_request','payout_paid','payout_rejected','payout_approved',
    'bounty_active','bounty_pending','bounty_rejected','bounty_completed','bounty_expired','bounty_review',
    'system'
  ));

-- =========================================================
-- Notification triggers for new tables
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_on_follow_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(display_name, username, 'Someone') INTO _name
      FROM public.profiles WHERE user_id = NEW.requester_id;
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (NEW.target_id, 'follow_request',
      COALESCE(_name,'Someone') || ' wants to follow you',
      'Open your requests to accept or decline.',
      NEW.requester_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow_request() FROM PUBLIC, anon;

CREATE TRIGGER trg_notify_follow_request
  AFTER INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow_request();

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(display_name, username, 'Someone') INTO _name
      FROM public.profiles WHERE user_id = NEW.followee_id;
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (NEW.follower_id, 'follow_accepted',
      COALESCE(_name,'A member') || ' accepted your follow request',
      'You are now following them.',
      NEW.followee_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon;

CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

CREATE OR REPLACE FUNCTION public.notify_on_circle_join_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rname TEXT; _cname TEXT; _owner UUID;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO _rname
    FROM public.profiles WHERE user_id = NEW.requester_id;
  SELECT name, owner_id INTO _cname, _owner
    FROM public.circles WHERE id = NEW.circle_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (_owner, 'circle_join_request',
      COALESCE(_rname,'Someone') || ' wants to join ' || COALESCE(_cname,'your circle'),
      'Open your circle requests to accept or decline.',
      NEW.requester_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (NEW.requester_id, 'circle_join_accepted',
      'You joined ' || COALESCE(_cname,'a circle'),
      'Welcome to the circle.',
      _owner);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (NEW.requester_id, 'circle_join_declined',
      'Your request to join ' || COALESCE(_cname,'a circle') || ' was declined',
      NULL,
      _owner);
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_on_circle_join_request() FROM PUBLIC, anon;

CREATE TRIGGER trg_notify_circle_join_request
  AFTER INSERT OR UPDATE ON public.circle_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_circle_join_request();

-- =========================================================
-- Enable realtime for the new tables (safe if already added)
-- =========================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.follows; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_join_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.circles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
