ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind = ANY (ARRAY[
  'circle_request','circle_accepted','follow_request','follow_accepted',
  'circle_join_request','circle_join_accepted','circle_join_declined','circle_coc_pending',
  'direct_message',
  'order_payment','order_sale',
  'payout_request','payout_paid','payout_rejected','payout_approved',
  'bounty_active','bounty_pending','bounty_rejected','bounty_completed','bounty_expired','bounty_review',
  'bounty_application_received','bounty_application_submitted','bounty_application_accepted','bounty_application_rejected',
  'bounty_solved','bounty_solved_admin','bounty_released','bounty_dispute_opened',
  'system','alert','announcement'
]));