# Payment Roadmap for Digital Assets — Escrow-First, In-App Chat Only

## Decision

Keep the **pay-first, escrow-protected** flow. All buyer↔seller communication and delivery for digital goods happens **exclusively in the in-app chat**. WhatsApp is removed entirely from the digital-goods path, and users are actively encouraged (with visible safety copy) to keep the whole transaction on Oventric.

Flow:
1. Buyer pays at checkout → funds held in escrow.
2. Seller is notified of a pending order.
3. Seller delivers the asset through in-app chat (file / link / note) and marks it delivered.
4. Buyer confirms receipt → escrow releases to seller wallet.
5. No confirmation after 48h → system auto-releases.
6. Anything wrong → buyer opens a dispute; admin mediates.

## Current state (verified)

- `OrderFulfilmentRoadmap.tsx` renders Paid → Delivered → Confirmed → Completed with confirm/dispute modals.
- `fulfilment.server.ts` holds `releaseEscrow` + `autoReleaseDueOrders` (48h).
- `fulfilment.functions.ts` exposes `markOrderDelivered`, `buyerConfirmReceipt`, `openOrderDispute`, `getDisputeUploadUrl`.
- `/order/$id` shows the roadmap; Dashboard has Purchases + Sales tabs.
- `/admin/disputes` mediation queue exists.
- Cron hook `/api/public/hooks/auto-release-orders` exists.

## Changes

### 1. Remove WhatsApp from digital goods
- Strip WhatsApp fields/buttons from the digital-asset checkout, product page, order page, and dashboard rows.
- Digital listings no longer collect or surface `whatsappNumber` / `deliveryWhatsapp`.
- Physical products keep their existing direct-contact behaviour (unchanged).
- Replace every removed WhatsApp CTA with a **Message in app** button.

### 2. Safety encouragement copy
- Persistent notice on the order page, chat thread header, and seller Sales row:
  > "Keep this trade on Oventric. Payments are held in escrow and we can only refund or mediate deals completed in-app."
- Warning banner in chat when a message contains an external contact pattern (phone number, "whatsapp", "telegram"): non-blocking inline caution.

### 3. Seller notification on new paid order
- In the Paystack webhook, after the order becomes `paid` + escrow `held`, insert a seller notification: "New order — `{product}` · `{amount}` held in escrow. Deliver now."
- Deep-link to Dashboard → Sales.

### 4. Order-aware chat + structured delivery
- Add nullable `order_id` context to message threads/messages.
- From an order, "Message buyer/seller" opens the thread tagged to that order.
- Seller gets a **Deliver order** action inside the chat: attach file/link/note → calls `markOrderDelivered` → auto-DM to buyer.

### 5. Buyer confirm CTA inside chat
- Sticky banner in an order-tagged thread once delivered: "Seller marked this delivered — confirm to release funds." with **Confirm receipt** and **Open dispute** buttons wired to the existing server fns.

### 6. Dashboard Sales polish
- Sales rows show product, buyer, amount, escrow status, primary **Mark delivered**, secondary **Message buyer**.
- Badge on orders pending delivery > 24h.

### 7. Auto-release safeguard
- 12h-before-auto-release notification to the buyer: "Auto-confirms in 12h — open a dispute if you haven't received the item."

## Out of scope
- Any off-platform payment or delivery path.
- Changes to the 80/20 split or currency isolation rules.
- Physical-product contact flow.

## Implementation order
1. DB: `order_id` on threads/messages; index.
2. Server fns: order-tagged thread open, deliver-with-note, seller new-order notification, 12h pre-release notice.
3. Webhook: seller notification on paid order.
4. UI: remove WhatsApp from digital paths; add in-app chat CTAs + safety copy.
5. UI: chat order banner (deliver / confirm / dispute).
6. Dashboard Sales polish.
7. Verify happy path, auto-release, and dispute end-to-end.