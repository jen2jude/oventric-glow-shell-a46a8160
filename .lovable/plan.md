# Plan - Standardize Checkout Header for Browser Visitors

The user is reporting that the "Select Payment Method" page (which is the Checkout page) still shows a mobile-style header (likely the dark app header) in white UI when accessed via URL on any device. The goal is to ensure all browser visitors see the white homepage-style header (`SiteNavbar`) on the checkout page, matching the pattern established for other routes.

## User Requirements
- For all URL access (web/browser), remove the mobile header/footer menu used for the app.
- Use the main homepage header (`SiteNavbar`) across all URL access (PC, tablet, mobile browser).
- The "Select Payment Method" page (Checkout) specifically needs this fix.

## Analysis
- `src/routes/checkout.$id.tsx` uses the `Header` component.
- The `Header` component has a `forceSiteNavbar` prop that, when `true`, renders the white `SiteNavbar`.
- In `src/routes/checkout.$id.tsx`, the `Header` is called at line 388: `<Header onOpenMessages={() => {}} light={!isAppShell} desktopNav={!isAppShell} />`.
- It's missing `forceSiteNavbar={!isAppShell}`.

## Proposed Changes

### 1. Update Checkout Page Header
- Modify `src/routes/checkout.$id.tsx` to pass `forceSiteNavbar={!isAppShell}` to the `Header` component.
- This will ensure browser users see the white `SiteNavbar`.

### 2. Verify Global Mobile Nav
- `src/routes/__root.tsx` already has logic to hide `GlobalMobileNav` if `!isAppShell`.
- `src/components/oventric/GlobalMobileNav.tsx` also has logic to hide on product/checkout pages.
- I will double-check `src/routes/__root.tsx` to be certain.

## Verification Plan

### Manual Verification
- Inspect `src/routes/checkout.$id.tsx` to confirm the prop is added.
- Check `src/routes/__root.tsx` for `GlobalMobileNav` visibility.

### Automated Verification
- No specific tests, but I will use `grep` to ensure no other occurrences of `Header` in major routes are missing this logic for URL access.
