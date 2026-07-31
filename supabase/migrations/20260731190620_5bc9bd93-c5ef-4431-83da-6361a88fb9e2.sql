ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid,
  ADD COLUMN IF NOT EXISTS delivery_note text,
  ADD COLUMN IF NOT EXISTS auto_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS public.order_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  against_user_id uuid,
  reason text NOT NULL,
  details text,
  image_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.order_disputes TO authenticated;
GRANT ALL ON public.order_disputes TO service_role;
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_parties" ON public.order_disputes;
CREATE POLICY "disputes_select_parties" ON public.order_disputes
  FOR SELECT TO authenticated
  USING (
    opened_by = auth.uid()
    OR against_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "disputes_insert_own" ON public.order_disputes;
CREATE POLICY "disputes_insert_own" ON public.order_disputes
  FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid());

CREATE INDEX IF NOT EXISTS order_disputes_order_idx ON public.order_disputes(order_id);
CREATE INDEX IF NOT EXISTS orders_auto_release_idx ON public.orders(auto_release_at) WHERE escrow_status = 'held';

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind = ANY (ARRAY[
  'circle_request','circle_accepted','follow_request','follow_accepted','circle_join_request','circle_join_accepted','circle_join_declined','circle_coc_pending','direct_message','order_payment','order_sale','payout_request','payout_paid','payout_rejected','payout_approved','bounty_active','bounty_pending','bounty_rejected','bounty_completed','bounty_expired','bounty_review','bounty_application_received','bounty_application_submitted','bounty_application_accepted','bounty_application_rejected','bounty_solved','bounty_solved_admin','bounty_released','bounty_dispute_opened','wall_post','mention','system','alert','announcement',
  'order_delivered','order_confirmed','order_completed','order_auto_released','order_dispute_opened','order_dispute_resolved'
]));