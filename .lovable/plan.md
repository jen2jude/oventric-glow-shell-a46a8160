## Goals
1. **Direct checkout** for products + course enrollments — Paystack Inline, no pre-fund required.
2. **Cashback Wallet** — separate spend-only balance (applies as discount at checkout, not withdrawable).
3. **Selective wallet funding** — the Fund Wallet CTA appears in bounty/ad flows on shortfall (inline top-up modal that resumes the action on success).
4. **Seller/Solver earnings** — continue crediting to internal wallet, withdrawable via existing payout flow.
5. **Existing wallet balances stay spendable** at checkout as an optional fallback (per user choice).

## Backend changes (single migration)
- Reuse existing `wallets.accumulated_cashback` as the Cashback Wallet balance.
- Add SQL RPCs:
  - `cashback_apply(_user_id, _amount_usd)` — debits cashback (spend-only, never inflow to available_balance).
  - `cashback_credit(_user_id, _amount_usd)` — replaces inline `UPDATE wallets` in `enrollPaid`/product purchase for cashback rewards.
- Add `wallet_transactions.type` values: `"Cashback Applied"`, `"Direct Card Purchase"` (no schema change; text column).
- Block cashback from payouts: `payout_request_create` already reads `available_balance`, so cashback is naturally excluded — verify.

## Server-fn changes
- `src/lib/marketplace.functions.ts`
  - `purchaseProduct` / product checkout: add `paymentMethod: "card" | "wallet"`. For `"card"`, initialize Paystack transaction and return authorization URL; on webhook success, complete the order and credit seller 80%/platform 20% (existing logic). For `"wallet"`, keep existing wallet-debit path.
  - Cashback rewards go to `accumulated_cashback` (not `available_balance`).
  - Allow buyer to apply up to `cashback_balance` as discount at card checkout.
- `src/lib/academy.functions.ts`
  - `enrollPaid`: add card path (Paystack init → webhook completes enrollment + 80/20 split + cashback credit).
- `src/lib/paystack.functions.ts` / webhook handler
  - Extend metadata to route completion by `purpose`: `topup`, `product_purchase`, `course_enrollment`, `bounty_escrow_topup`, `ad_escrow_topup`.
- `src/lib/payouts.functions.ts` — unchanged; confirm cashback excluded.

## UI changes
- **CourseCheckoutModal** (`src/components/oventric/CourseCheckoutModal.tsx`)
  - Default method = `card`. Show wallet only if `available_balance >= total`.
  - Show cashback available and a "Apply cashback (max X)" input; deduct from total.
  - On card: launch Paystack Inline; on success, invoke enrollment completion.
- **Product checkout** (`src/routes/checkout.$id.tsx`)
  - Same pattern: default card, wallet as optional fallback, cashback discount input.
- **BountyEditorModal** (`src/components/oventric/BountyEditorModal.tsx`)
  - On publish with shortfall → inline `TopUpForBountyModal` (Paystack Inline for exact NGN/GHS/USD equivalent). On success + webhook credit, retry publish.
- **AdvertiseInquiryModal / ads-manager** — same inline top-up pattern for campaign escrow.
- **Wallet.tsx**
  - Cashback card: label "Spend at checkout only". Remove Withdraw affordance for cashback.
  - Fund Wallet: reframe as "Fund wallet for bounties & ads". Copy update only; still usable from wallet page.
  - Withdraw: continue to use `available_balance` only.

## Out of scope
- No changes to KYC, existing escrow release logic, or the payout provider (Paystack Transfers).
- No migration of existing wallet balances (stay spendable per Q3).

## Rollout order
1. Migration (RPCs + verify grants).
2. Server fns (paystack purpose routing, cashback helpers, enrollPaid/purchaseProduct card path).
3. Checkout UIs (CourseCheckoutModal, product checkout).
4. Shortfall inline top-up in bounty & ad flows.
5. Wallet UI cashback framing.
6. Smoke test with Playwright against a course + bounty flow.