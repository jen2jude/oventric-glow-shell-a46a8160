
-- 1. Circles: category, visuals, code of conduct, aggregate totals
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'SaaS Builders',
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '🛡️',
  ADD COLUMN IF NOT EXISTS banner_hue text NOT NULL DEFAULT 'from-emerald-500 via-teal-600 to-cyan-700',
  ADD COLUMN IF NOT EXISTS avatar_hue text NOT NULL DEFAULT 'from-emerald-500 to-teal-700',
  ADD COLUMN IF NOT EXISTS code_of_conduct jsonb NOT NULL DEFAULT jsonb_build_object(
    'pledge','Be kind, respectful, and constructive. No spam, harassment, or self-promo without value.',
    'questions', jsonb_build_array(
      jsonb_build_object('id','q1','text','Why do you want to join this circle?'),
      jsonb_build_object('id','q2','text','What will you contribute to other members?'),
      jsonb_build_object('id','q3','text','Have you read and will you respect the pinned rules?'),
      jsonb_build_object('id','q4','text','Will you keep discussions on-topic and helpful?'),
      jsonb_build_object('id','q5','text','Will you treat every member with respect?')
    )
  );

-- 2. Members: track CoC acceptance
ALTER TABLE public.circle_members
  ADD COLUMN IF NOT EXISTS coc_accepted_at timestamptz;

-- 3. Join requests: store CoC answers + broaden status
ALTER TABLE public.circle_join_requests
  ADD COLUMN IF NOT EXISTS coc_answers jsonb;

ALTER TABLE public.circle_join_requests
  DROP CONSTRAINT IF EXISTS circle_join_requests_status_check;
ALTER TABLE public.circle_join_requests
  ADD CONSTRAINT circle_join_requests_status_check
  CHECK (status = ANY (ARRAY['pending','awaiting_coc','accepted','declined']));

-- 4. Posts: bind to a circle (nullable = public feed)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.circles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS posts_circle_id_created_idx ON public.posts (circle_id, created_at DESC);

-- 5. Rework posts RLS to respect circle membership
DROP POLICY IF EXISTS posts_select_all_authed ON public.posts;
DROP POLICY IF EXISTS "public can read posts" ON public.posts;
DROP POLICY IF EXISTS posts_insert_own ON public.posts;
DROP POLICY IF EXISTS posts_select_public ON public.posts;
DROP POLICY IF EXISTS posts_select_members ON public.posts;

CREATE POLICY posts_select_public ON public.posts
  FOR SELECT USING (circle_id IS NULL);
CREATE POLICY posts_select_members ON public.posts
  FOR SELECT TO authenticated
  USING (circle_id IS NOT NULL AND public.is_circle_member(auth.uid(), circle_id));
CREATE POLICY posts_insert_own ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (circle_id IS NULL OR public.is_circle_member(auth.uid(), circle_id))
  );

-- 6. Circle-scoped shared resources
CREATE TABLE IF NOT EXISTS public.circle_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'Link',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_resources TO authenticated;
GRANT ALL ON public.circle_resources TO service_role;

ALTER TABLE public.circle_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY cr_select_members ON public.circle_resources
  FOR SELECT TO authenticated
  USING (public.is_circle_member(auth.uid(), circle_id));
CREATE POLICY cr_insert_members ON public.circle_resources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_circle_member(auth.uid(), circle_id) AND auth.uid() = added_by);
CREATE POLICY cr_delete_owner_or_admin ON public.circle_resources
  FOR DELETE TO authenticated
  USING (auth.uid() = added_by OR public.is_circle_admin(auth.uid(), circle_id));
CREATE POLICY cr_update_admin ON public.circle_resources
  FOR UPDATE TO authenticated
  USING (public.is_circle_admin(auth.uid(), circle_id))
  WITH CHECK (public.is_circle_admin(auth.uid(), circle_id));

-- 7. Update join-request notification trigger to route CoC step correctly
CREATE OR REPLACE FUNCTION public.notify_on_circle_join_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _rname TEXT; _cname TEXT; _cslug TEXT; _owner UUID;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO _rname
    FROM public.profiles WHERE user_id = NEW.requester_id;
  SELECT name, slug, owner_id INTO _cname, _cslug, _owner
    FROM public.circles WHERE id = NEW.circle_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (_owner, 'circle_join_request',
      COALESCE(_rname,'Someone') || ' wants to join ' || COALESCE(_cname,'your circle'),
      'Review the request in your circle requests inbox.',
      NEW.requester_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'awaiting_coc' AND OLD.status IS DISTINCT FROM 'awaiting_coc' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
    VALUES (NEW.requester_id, 'circle_coc_pending',
      'Almost in — accept the code of conduct for ' || COALESCE(_cname,'the circle'),
      'Answer a few questions and agree to the pledge to join.',
      '/?circle=' || COALESCE(_cslug,''),
      _owner);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, from_user_id)
    VALUES (NEW.requester_id, 'circle_join_accepted',
      'You joined ' || COALESCE(_cname,'a circle'),
      'Welcome to the circle.',
      '/?circle=' || COALESCE(_cslug,''),
      _owner);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, from_user_id)
    VALUES (NEW.requester_id, 'circle_join_declined',
      'Your request to join ' || COALESCE(_cname,'a circle') || ' was declined',
      NULL,
      _owner);
  END IF;
  RETURN NEW;
END; $function$;
