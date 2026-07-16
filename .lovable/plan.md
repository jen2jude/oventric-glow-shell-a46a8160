# Live Paystack Funding + Payout

## What we're building

Two buttons on **Sovereign Wallet → Other Wallet**:

1. **Fund Wallet** (renamed from "Add Liquid Capital") — already wired to Paystack Checkout via `initPaystackPayment`. Just rename the label + subtitle. No logic change.
2. **Request Payout** (renamed from "Request Payout" — same) — becomes a **live** payout that pushes money from Paystack balance directly to the user's bank (NG) / mobile money or bank (GH). USD stays manual-admin (Paystack doesn't payout USD to international wires).

## User flow — first-time payout

```text
Click "Request Payout"
  → Liveness selfie (existing KYC gate)
  → Bank Details form (NEW — one-time per user)
       NG: Bank + 10-digit NUBAN → Paystack account name lookup (auto-fills, prevents typos)
       GH: MoMo (network + phone) OR Bank + account
  → Amount + fee preview (see below)
  → Submit → Paystack Transfer API executes → wallet debited → tx logged
```

## User flow — returning payout user

```text
Click "Request Payout"
  → Liveness selfie only (verify same face)
  → Pick saved bank/momo OR add new
  → Amount + fee preview
  → Submit → live transfer
```

## Fee handling (auto-deducted from user's amount)

Paystack Transfer fees (as of 2026):
- **NG bank:** ₦10 (≤₦5k) / ₦25 (≤₦50k) / ₦50 (>₦50k)
- **GH bank:** GHS 1 flat
- **GH MoMo:** 1% + GHS 1 (capped at GHS 8)

Show a live preview on the amount input:

```text
You requested:      ₦20,000
Paystack fee:       −₦25
Bank receives:      ₦19,975    ← user sees this before submit
```

Fee is subtracted from the **requested amount** before transfer, so the user's wallet is debited the full requested amount and the bank receives net.

## Technical details

### 1. DB migration — save bank details + track transfer state
- New table `payout_recipients` (user_id, currency, method, bank_name, bank_code, account_number, account_name, momo_network, phone, paystack_recipient_code, is_default, verified_at, timestamps). RLS: owner-only.
- Extend `payout_requests` with columns: `paystack_transfer_code`, `paystack_recipient_code`, `fee_amount`, `net_amount` (nullable, backfilled null).
- New RPC `payout_request_create_v2(...)` OR extend the existing to accept fee/net; simpler: pass them from the server function directly via `supabaseAdmin` on the `payout_requests` insert instead of the RPC, since RPC is user-context. Keep existing RPC for USD manual path.

### 2. Server functions (`src/lib/payouts.functions.ts`)
- `paystackListBanks(country)` — proxy `GET /bank?country=nigeria|ghana` (cached in memory 24h).
- `paystackResolveAccount({ bank_code, account_number })` — proxy `GET /bank/resolve` → returns `account_name` for NG.
- `createOrGetRecipient({ currency, method, ... })` — POST `/transferrecipient`, persist code in `payout_recipients`, return code.
- `listMyRecipients()` — user's saved destinations.
- `createLivePayout({ recipientId, amount, currency })`:
  1. Auth via `requireSupabaseAuth`.
  2. Compute Paystack fee (server-side helper `estimatePaystackTransferFee`).
  3. Validate wallet balance ≥ requested.
  4. Insert `payout_requests` (status=`processing`, fee/net populated).
  5. Debit wallet (move requested → escrow via existing RPC).
  6. POST `/transfer` with reason + reference = payout id.
  7. On sync response (`status=success/otp`), update row with `paystack_transfer_code`. Otherwise leave `processing`; webhook resolves.

### 3. Webhook (`src/routes/api/public/paystack-webhook.ts`)
Extend the existing HMAC-verified webhook to handle:
- `transfer.success` → mark payout `paid`, clear escrow, insert `wallet_transactions` row `Payout Withdrawal` status=success.
- `transfer.failed` / `transfer.reversed` → refund escrow → available, mark `rejected`.

### 4. UI (`src/components/oventric/Wallet.tsx`)
- Rename button label + subtitle: "Fund wallet · Card · Bank · Mobile Money".
- Replace the current `PayoutModal` with a new three-step flow: **Liveness (existing) → Destination → Amount + preview**.
- Fee preview line computed live in-browser mirroring the server helper.
- NG account-name auto-lookup after 10 digits typed.
- USD tab keeps the current manual admin-approval form (unchanged).

### 5. Files touched
- `supabase/migrations/*` — new table + payout_requests columns.
- `src/lib/payouts.functions.ts` — new server fns.
- `src/lib/paystack.functions.ts` — add transfer helpers + fee estimator (server-only).
- `src/routes/api/public/paystack-webhook.ts` — handle transfer events.
- `src/components/oventric/Wallet.tsx` — new payout modal, rename fund button.

## Notes / constraints

- **KYC flow preserved.** Existing `ensureKyc` (enroll) and `verifyLiveness` (match) are used unchanged. Bank-details form is a NEW step **after** liveness, not part of KYC.
- **USD wire stays manual** — Paystack Transfers do not settle to non-NG/GH international banks.
- **Paystack Transfers must be enabled on the merchant dashboard** with sufficient balance. If disabled, the API returns a clear error which we surface to the user with a "Contact support" fallback.
- Balance debit + transfer initiation happen in the same server function; webhook is the source of truth for final status. If the initial POST fails, we refund escrow immediately.

Approve to proceed and I'll ship it end-to-end.
