# Plan - Fix "Back to Marketplace" Navigation

The "Back to Marketplace" button currently takes users to the home page instead of returning them to the Marketplace section. This is likely because the `window.history.back()` call fails (e.g., direct link entry) or the fallback logic isn't correctly targeting the "Marketplace" section on the home page.

## Proposed Changes

### 1. Product Page (`src/routes/product.$id.tsx`)
- Refactor the back button logic for both `isAppShell` and browser versions.
- Ensure that if `window.history.back()` is not suitable (or as a safer alternative), we navigate to `/` and trigger the `oventric:navigate` event specifically for the "Marketplace" section.
- Add a check to see if the referrer was actually the marketplace before deciding to go back or redirect.

### 2. Global Mobile Navigation (`src/components/oventric/GlobalMobileNav.tsx`)
- Ensure that when navigating back to the home page from a product, the global navigation correctly reflects the "Marketplace" state if that's where the user is headed.

## Verification Plan

### Automated Testing (Playwright)
- Navigate directly to a product URL (no history).
- Click "Back to Marketplace".
- Verify the URL is `/` and the "Marketplace" section is active (by checking for elements unique to the marketplace, like "Lightning Deals").

### Manual Verification
- Open the preview.
- Go to the Marketplace section.
- Click a product.
- Click "Back to Marketplace".
- Verify it returns to the Marketplace section, not the default Home section.
