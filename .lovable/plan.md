
# Real Marketplace Checkout Flow

Replace the mock `alert("Proceeding to checkout")` with a full purchase pipeline backed by real user-uploaded digital assets, wallet payments, country-aware top-up, download delivery, and a receipt email.

## Scope

Marketplace items become real records created by sellers (existing "admin/forge" flow already writes to a store — we'll promote it to a real `products` table). Buyers get a product detail page, checkout page, wallet/card payment, wallet top-up on insufficient balance, download delivery page, and a confirmation email.

## Backend (migration + storage)

New tables (all with GRANTs + RLS in the same migration):

- `products` — id, seller_id (auth.users), name, category (themes/plugins/blocks/scripts), description, price_usd, hue, cover_path (storage), file_path (storage, nullable), external_url (nullable), rating default 5, reviews default 0, promoted bool, created_at. Public SELECT to `anon` + `authenticated`; INSERT/UPDATE/DELETE only to owner.
- `orders` — id, buyer_id, product_id, seller_id, quantity, unit_price_usd, total_usd, currency (USD/NGN/GHS), fx_rate, payment_method (wallet/card), status (pending/paid/failed), created_at, paid_at. RLS: buyer sees own, seller sees own sales.
- `order_downloads` — order_id, download_token (uuid), expires_at, download_count. Buyer-only SELECT; used to gate signed URL / external link reveal.

New storage buckets: `product-covers` (public), `product-files` (private, signed URL on delivery). RLS: sellers upload to their own folder; buyers read only via signed URL from server function after order paid.

Extend existing `wallets` — add credit/debit RPCs (`wallet_credit`, `wallet_debit`) as SECURITY DEFINER with balance check.

## Server functions

`src/lib/marketplace.functions.ts`:
- `listProducts({ category?, search?, page })` — public.
- `getProduct({ id })` — public, includes seller display info.
- `createOrder({ productId, quantity, currency, paymentMethod })` — auth-required. Computes total, checks wallet balance if `wallet`, calls `wallet_debit`, credits seller wallet (minus platform fee later), marks order `paid`, generates download token. If insufficient balance → returns `{ needsTopUp: true, shortfallUsd }`.
- `topUpWallet({ amountUsd, currency, method })` — auth-required. Mock card processor for now (success unless amount ends in .13), credits buyer wallet, writes `wallet_transactions` row. Real gateway wiring can slot in later.
- `getDownload({ orderId })` — auth-required, buyer-only. Returns signed URL for `product-files` or the seller-provided `external_url`.
- `sendReceipt({ orderId })` — enqueues receipt email using existing email infrastructure if configured; otherwise no-op with a log line (I'll set up email infra only if the user asks).

Admin `MarketplaceForge` (already in Admin.tsx) is rewired to write into `products` instead of the in-memory `useAdminStore`. Existing seed catalog stays as static fallback so the marketplace isn't empty on a fresh DB.

## Frontend

New routes (TanStack):
- `/marketplace/product/$id` — detail page: cover, description, seller, rating, price in active currency, quantity stepper (only if `allow_quantity` — default 1 for digital), "Buy now" → `/marketplace/checkout/$id?qty=`.
- `/marketplace/checkout/$id` — order summary, payment method selector:
  - **Wallet balance** (shows current balance in active currency, disabled if insufficient with inline "Top up" CTA).
  - **Card** — country-aware method list derived from `profile.country`: NG → Card / Bank Transfer / USSD (Paystack-style labels), GH → Mobile Money / Card, US/EU/other → Card only. UI only; all routed through the same mock `topUpWallet` for now (real Paystack/Stripe integration is a follow-up).
  - Confirms → calls `createOrder`. On `needsTopUp`, opens top-up modal for the shortfall using the country-appropriate methods, then retries order.
- `/marketplace/order/$id` — success page with download button, receipt summary, "email sent to X" confirmation.

`Marketplace.tsx`: `handleBuy` no longer alerts — navigates to product detail. Cards become links. Admin-forged products render from DB.

Auth gate: buying requires level-2 auth (existing `require(2, ..., "buyer")`) — kept.

## Email receipt

If Lovable Emails infrastructure is already set up in the project, add a `purchase-receipt` template and call it from `createOrder` after payment success. If not set up, I'll flag it and set it up in the same turn (needs an email domain — I'll check status first). Template: product name, order id, amount paid, download link, seller.

## Out of scope for this change

- Real card processor integration (Paystack/Stripe) — mocked with a deterministic pass/fail so the flow is testable end-to-end. Wiring a real processor is a clean follow-up once you pick the provider per country.
- Refunds, disputes, platform fee split, seller payout schedule.
- Physical product shipping.

## Verification

After implementing, I'll drive the flow with Playwright: create a product via admin, buy it as a signed-in user with empty wallet, top up, complete purchase, hit the download route, and confirm the receipt call fired.
