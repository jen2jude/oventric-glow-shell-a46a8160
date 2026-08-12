# Sovereign Wallet UI Overhaul

Redesign the Sovereign Wallet experience to precisely mirror the reference designs (wallet01–wallet04) using Oventric's premium dark theme (#0A0A0B), crimson accents (#E5484D), and standard 10px corner radius.

## User Review Required

> [!IMPORTANT]
> The reference design shows a specific header style (logo center, search left, notifications right). I will apply this to the wallet page as requested.

## Proposed Changes

### Wallet Dashboard (`src/components/oventric/Wallet.tsx`)
- **Main Balance Card**: Redesign as a full-width glassmorphic card with a deep dark background, crimson top-border glow, and centered balance display.
- **Quick Actions**: Implement a horizontal row of four compact action buttons (Fund, Withdraw, Send, Request) with modern icons and labels.
- **Sub-Wallet Grid**: Create a 2x2 grid of specialized cards for Cashback, Bounty, Escrow, and Seller earnings, matching the reference visual style.
- **Cashback Estimator**: Revamp the planning tool with a sleek slider, tier badges (Baseline, Elite, Apex), and an earnings visualization card.
- **Transaction Ledger**: Implement the detailed history view with category-specific icons (Purchase, Cashback, Bounty) and formatted currency amounts.

### Payment Flow
- **Add Funds Screen**: Rebuild the funding modal with payment method selection (Bank, Card, Crypto) and amount presets (10K, 20K, etc.) as seen in `wallet02.png`.
- **Payout & Send Flow**: Standardize the withdrawal and user-transfer interfaces to match the new dashboard aesthetic.

### App Integration
- **Mobile Header**: Inject the app-shell header (from `FeedAppChrome`) into the wallet route for a consistent mobile application feel.
- **Theme Polish**: Ensure all UI elements use `rounded-[10px]`, crimson (#E5484D) accents for primary actions, and appropriate semantic colors for transaction types.

## Technical Details
- Utilize `OnboardingContext` for multi-currency balance state.
- Leverage `useDominantColor` for dynamic UI highlights where applicable.
- Maintain existing TanStack Start server functions for all financial operations.
- Standardize all glassmorphic effects using Oventric's background-blur and border-opacity tokens.
