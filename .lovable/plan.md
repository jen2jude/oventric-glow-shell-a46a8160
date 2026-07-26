# Reset the Currency Model — One Currency Per User

## Rules (single source of truth)

- **NG users** transact ONLY in NGN. They cannot see, hold, earn, spend, top-up, or withdraw USD or GHS.
- **GH users** transact ONLY in GHS. Same restriction.
- **OTHER users** transact ONLY in USD. Their transactions are handled manually by admin (no Paystack rails).
- **Logged-out visitors** see prices in USD equivalent only (marketing preview).
- A listing published in one currency is only purchasable by users whose base currency matches. Cross-currency purchases are blocked at both the UI and server layer — no auto-conversion at checkout.

## Changes

### 1. Discovery surfaces (Marketplace, Bounties, Academy)
- Filter list queries to only show items where `original_currency === user.baseCurrency`. Logged-out users see all items priced in USD equivalent (display-only).
- Remove any UI element that renders converted "≈" secondary prices for logged-in users. Show the native price only.

### 2. Publish flows (Sell Asset/Physical, Bounty Editor, Course Publish)
- Lock `original_currency` to the user's `baseCurrency` — remove currency pickers. NG users can only post in NGN, GH in GHS, OTHER in USD.

### 3. Wallet UI (`Wallet.tsx`)
- Show ONLY the user's home-currency wallet row. Hide USD/other rows for NG/GH; hide NGN/GHS for OTHER users.
- Fund Wallet: locked to home currency (already partly done).
- Payout: locked to home currency. OTHER users see "Manual payout — admin will contact you" flow instead of Paystack.

### 4. Checkout (`checkout.$id.tsx`, `CourseCheckoutModal.tsx`)
- Block checkout when `product.original_currency !== user.baseCurrency` with a clear message ("This item is priced in NGN and only available to Nigerian accounts").
- Remove USD fallback conversion at checkout. Charge in `original_currency` only.

### 5. Server settlement (`paystack.functions.ts`, `marketplace.functions.ts`, `academy.functions.ts`, `bounties.functions.ts`)
- Credit seller/solver earnings in the SAME currency as the listing (already partly via `wallet_credit_currency`) — audit and remove any residual USD-only `wallet_credit` calls for marketplace/academy/bounty payouts.
- Bounty solver payout: credit in the bounty's original currency, not USD.
- Cashback: credit in the buyer's home currency (2% of gross in that currency), not USD.

### 6. Dashboard metrics
- Show earnings/spend in home currency only. Remove the "+ USD equivalent" secondary line for NG/GH users.

### 7. Data migration (non-destructive)
- Do NOT touch existing balances. Existing stranded USD balances for NG/GH users stay in the DB but are hidden from UI. Add an admin tool later to sweep/convert them (out of scope for this pass).

## Technical notes

- `computeDisplayPrice` stays as-is (still used for logged-out USD preview).
- New helper `canTransact(row, user)` → boolean that gates checkout + purchase server-side.
- Publish server fns reject any `original_currency !== profile.country's currency`.
- Bounty escrow uses `wallet_debit_currency` in home currency (already available).

## Out of scope
- Sweeping/converting existing stranded balances (admin task).
- Multi-currency payout rails for OTHER users beyond a "manual review" queue.
