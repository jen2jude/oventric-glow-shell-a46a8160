
-- 1) Column + index
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS wall_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS posts_wall_user_id_created_idx
  ON public.posts (wall_user_id, created_at DESC)
  WHERE wall_user_id IS NOT NULL;

-- 2) Allow the 'wall_post' notification kind
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind = ANY (ARRAY[
    'circle_request','circle_accepted','follow_request','follow_accepted',
    'circle_join_request','circle_join_accepted','circle_join_declined','circle_coc_pending',
    'direct_message','order_payment','order_sale',
    'payout_request','payout_paid','payout_rejected','payout_approved',
    'bounty_active','bounty_pending','bounty_rejected','bounty_completed','bounty_expired',
    'bounty_review','bounty_application_received','bounty_application_submitted',
    'bounty_application_accepted','bounty_application_rejected',
    'bounty_solved','bounty_solved_admin','bounty_released','bounty_dispute_opened',
    'wall_post','mention',
    'system','alert','announcement'
  ])
);

-- 3) RLS: allow wall inserts by followers of the wall owner (or the owner themself)
DROP POLICY IF EXISTS posts_insert_wall ON public.posts;
CREATE POLICY posts_insert_wall ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
    AND auth.uid() = author_id
    AND wall_user_id IS NOT NULL
    AND circle_id IS NULL
    AND (
      wall_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.followee_id = wall_user_id
          AND f.follower_id = auth.uid()
      )
    )
  );

-- 4) Wall posts visible to any signed-in visitor
DROP POLICY IF EXISTS posts_select_wall ON public.posts;
CREATE POLICY posts_select_wall ON public.posts
  FOR SELECT TO authenticated
  USING (
    wall_user_id IS NOT NULL
    AND ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  );

-- 5) Notify the wall owner when someone else posts on their wall
CREATE OR REPLACE FUNCTION public.notify_on_wall_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _slug text;
  _link text;
BEGIN
  IF NEW.wall_user_id IS NULL OR NEW.wall_user_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, username, 'Someone')
    INTO _name
    FROM public.profiles WHERE user_id = NEW.author_id;
  SELECT slug INTO _slug FROM public.profiles WHERE user_id = NEW.wall_user_id;
  _link := '/profile/' || COALESCE(_slug, NEW.wall_user_id::text);
  INSERT INTO public.notifications (user_id, kind, title, body, from_user_id, link)
  VALUES (
    NEW.wall_user_id,
    'wall_post',
    COALESCE(_name,'Someone') || ' posted on your wall',
    LEFT(COALESCE(NEW.text,''), 140),
    NEW.author_id,
    _link
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_wall_post_trg ON public.posts;
CREATE TRIGGER notify_on_wall_post_trg
  AFTER INSERT ON public.posts
  FOR EACH ROW
  WHEN (NEW.wall_user_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_on_wall_post();
