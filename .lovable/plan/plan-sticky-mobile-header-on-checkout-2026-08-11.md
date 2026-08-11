# Plan - Sticky Mobile Header on Checkout

Make the mobile header sticky on the checkout page to ensure navigation is always accessible while scrolling.

## User Review Required

> [!IMPORTANT]
> The header is currently configured to be sticky by default, but its behavior can be suppressed by parent containers or specific props (like `forceSiteNavbar`). I will ensure it stays pinned regardless of the view mode (App Shell vs. Browser).

## Proposed Changes

### Frontend

#### `src/routes/checkout.$id.tsx`
- Ensure the parent container of the `Header` doesn't have `overflow-hidden` or other styles that break `sticky` positioning.
- Adjust the top padding of the content area if the sticky header causes overlap issues.

#### `src/components/oventric/desktop/SiteNavbar.tsx` (if applicable)
- Verify `SiteNavbar` has `sticky top-0 z-40` classes when rendered in the checkout context.

## Verification Plan

### Automated Tests
- None required for this visual change.

### Manual Verification
- Open the checkout page on a mobile viewport.
- Scroll down the page.
- Verify the header remains fixed at the top of the screen.
- Verify no content is hidden behind the header unexpectedly.
