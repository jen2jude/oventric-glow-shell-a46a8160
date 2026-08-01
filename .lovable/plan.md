## Goal

Widen payment coverage now that the platform serves all African countries:

1. **Flutterwave** becomes the primary gateway (test mode until your account clears validation).
2. **Paystack** stays wired as a fallback, chosen automatically per currency.
3. **MiniPay** is added as a manual transfer option on **direct payments only** — product purchases, Academy courses, and bounty posting. It is **not** offered in the wallet funding flow.

## Why this helps

Paystack can only charge in NGN, GHS, ZAR, KES, USD — everyone else is currently forced into a USD cross-border charge with a ~3.9% + $0.30 fee. Flutterwave settles natively in NGN, GHS, KES, ZAR, UGX, TZS, RWF, XAF, XOF, ZMW, MWK, EGP, MAD (plus USD/GBP/EUR), so most African users get charged in their own currency with local cards, bank transfer, and mobile money.

## 1. Gateway router

A single decision point picks the provider for a given currency and amount:

- Currency natively supported by Flutterwave and Flutterwave is enabled → **Flutterwave**
- Otherwise, currency is NGN/GHS/ZAR/KES → **Paystack**
- Otherwise → Flutterwave in USD (widest reach) with the home currency recorded in metadata, so settlement still lands in the user's own currency
- MiniPay is never auto-selected — it is an explicit user choice, and only on the direct-payment screens

The existing FX layer, cashback logic, 80/20 seller split, and wallet settlement stay untouched. Only the "who charges the card" layer changes.

## 2. Flutterwave integration

New server-only module mirroring the current Paystack one, so the rest of the app doesn't care which gateway ran:

- Initialize a payment (Standard hosted checkout) → returns a redirect URL
- Verify by transaction ID / tx_ref on return
- Signed webhook endpoint (`verif-hash` header) with the same duplicate-event table pattern already used for Paystack, so retries can never double-credit a wallet
- Fee model file for Flutterwave's local/international card and mobile-money rates, used by both the "you'll be charged X" preview and the server charge, exactly like today

**Payouts:** Flutterwave Transfers becomes the default withdrawal rail — bank list, account name resolution, recipient creation, transfer initiation, and transfer webhook status handling (success / failed / reversed → escrow refund). This unlocks withdrawals to far more countries and to mobile-money wallets (M-Pesa, MTN MoMo, Airtel). Paystack transfers remain available for existing NGN/GHS recipients.

**Test mode:** everything runs on your test keys. A single config flag flips live when validation completes — no code change needed.

## 3. MiniPay manual transfer (direct payments only)

MiniPay has no charge API, so this is a proof-of-payment flow. It appears as a payment option **only** on:

- Marketplace product checkout
- Academy course checkout
- Bounty posting (escrow funding)

It does **not** appear in the Fund Wallet flow.

How it works:

- User picks "Pay with MiniPay"
- Screen shows your MiniPay number/handle, the exact amount in their currency, and a unique reference code to include in the transfer note
- User uploads a screenshot of the transfer
- The order / enrolment / bounty is created in a **"Payment pending confirmation"** state — nothing is delivered, escrowed, or published yet
- Admin sees it in a review queue with the proof, reference, and amount
- **Approve** → the exact same settlement path the card gateways use runs (order paid, course unlocked, bounty escrowed and published, cashback credited)
- **Reject** → the pending record is cancelled with a reason
- Buyer and seller both get notifications at each step; the buyer sees a clear "Awaiting confirmation" state meanwhile

Because delivery is gated on admin approval, digital products bought via MiniPay are held until confirmed rather than released instantly — the UI states this upfront so buyers who want instant access pick a card option.

## 4. Admin controls

New section in admin settings:

- Toggle each gateway on/off (Flutterwave, Paystack, MiniPay)
- Set MiniPay receiving details and which currencies it accepts
- MiniPay review queue with proof image, reference, amount, buyer, target item, and approve/reject

## Technical notes

- New tables: `manual_payments` (user, purpose, target id, currency, amount, reference, proof path, status, reviewer, reason) and `flutterwave_webhook_events` (dedupe). New `payment-proofs` storage bucket with owner-scoped RLS; admins read via the service role.
- `payout_recipients` / `payout_requests` gain a `provider` column so existing Paystack recipients keep working while new ones go to Flutterwave.
- `src/lib/currency/africa.ts` gains a `FLUTTERWAVE_CURRENCIES` list; the router replaces the current `gatewayCurrency()` helper.
- The settlement logic currently inside the Paystack verify path is extracted into a provider-agnostic function so card payments and approved MiniPay payments run identical fulfilment.
- New files: `src/lib/flutterwave.functions.ts`, `src/lib/flutterwave-transfers.server.ts`, `src/lib/flutterwave-fees.ts`, `src/lib/payments/router.ts`, `src/lib/manual-payments.functions.ts`, `src/routes/api/public/flutterwave-webhook.ts`, `src/routes/admin.manual-payments.tsx`, plus a MiniPay payment modal component.
- Existing Paystack files stay in place and are still reachable through the router; the payment return page handles both providers.
- Secrets needed: `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_ENCRYPTION_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`. I'll request these when we start; test keys are fine.
- Webhook URL to register in your Flutterwave dashboard: `https://oventric.com/api/public/flutterwave-webhook`.

## Order of work

1. Database migration (tables, columns, bucket)
2. Currency registry + gateway router + shared settlement extraction
3. Flutterwave charge + verify + webhook
4. Flutterwave payouts and bank/momo resolution
5. MiniPay manual flow on the three direct-payment screens + admin queue
6. Admin gateway toggles, then end-to-end test in Flutterwave test mode
