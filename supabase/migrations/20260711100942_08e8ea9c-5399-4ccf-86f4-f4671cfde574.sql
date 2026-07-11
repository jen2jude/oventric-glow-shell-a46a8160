ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind = ANY (ARRAY[
  'system','announcement','direct_message','alert',
  'order_payment','order_sale','order_completed','order_refunded',
  'circle_request','circle_accepted','circle_declined',
  'payout_request','payout_approved','payout_paid','payout_rejected','payout_pending',
  'bounty_active','bounty_completed','bounty_cancelled','bounty_awarded','bounty_submitted','bounty_pending','bounty_rejected','bounty_approved',
  'wallet_credit','wallet_debit','wallet_topup'
]));