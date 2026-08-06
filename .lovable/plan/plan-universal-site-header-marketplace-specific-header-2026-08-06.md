# Plan: Universal Site Header & Marketplace-Specific Header

The user wants to separate the "Temu-style" multi-tier header from the general homepage and move it specifically to the Marketplace header. The main site header should become a "Universal Header".

## Proposed Changes

### 1. Create Marketplace Header Component
- Create `src/components/oventric/desktop/MarketplaceHeader.tsx`.
- Copy the Temu-style multi-tier logic from the current `SiteNavbar.tsx` (Utility bar, Main header with profile/flag/cart, and the Red Brand Strip).

### 2. Restore Universal Site Header
- Simplify `src/components/oventric/desktop/SiteNavbar.tsx`.
- Remove the top utility bar, red brand strip, and the detailed user info (Orders & Account, flag, cart) from the main header.
- Keep it clean with Logo, Search, and simple Auth/Profile actions.

### 3. Update Route Layout
- In `src/routes/index.tsx`, manage the headers for browser visitors (`!isAppShell`).
- If `active === "Home"`, show the simplified `SiteNavbar`.
- If `active === "Marketplace"`, show the new `MarketplaceHeader`.
- For other sections (Academy, Bounties, etc.), show the `SiteNavbar` or `Header` as appropriate for browser users.

### 4. Refactor Desktop Home
- Remove the `SiteNavbar` from `src/components/oventric/desktop/DesktopHome.tsx` since the header will now be managed at the route level in `index.tsx`.

## Verification Plan

### Automated Checks
- Verify that `src/components/oventric/desktop/MarketplaceHeader.tsx` exists and renders the multi-tier header.
- Verify that `SiteNavbar` is now a simple, single-tier header.
- Verify that navigating between Home and Marketplace in the browser context correctly swaps the headers.

### Manual Verification
- Open the preview URL.
- Observe the homepage header (should be clean/universal).
- Navigate to the Marketplace (should show the Temu-style header with the red strip and utility bar).
- Check the app-shell view (should still use the `Header.tsx` component).
