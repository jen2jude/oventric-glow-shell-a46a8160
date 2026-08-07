# Plan - Fix Back Button Visibility on App Checkout Page

The user reports that the back button on the "Select Payment Method" (checkout) screen in the app version is not visible or cut off from the top. Currently, for `isAppShell`, the back button is `absolute top-4 left-4 z-20`. Since the `Header` is also present (as established in previous turns), it might be overlapping or pushing content down, or the `absolute` positioning might be conflicting with the `Header` or safe areas.

## Proposed Changes

### `src/routes/checkout.$id.tsx`
- Remove `absolute` positioning from the back button for `isAppShell`.
- Place it within a container that respects the `Header` and `safe-area-inset-top`.
- Adjust `z-index` and margins to ensure it is visible below the `Header` but before the main content.

## Verification Plan

### Automated Tests
- Run a Playwright script to:
  1. Navigate to `/checkout/some-id?mode=app`.
  2. Verify the `ArrowLeft` icon is visible and not obscured by the header.
  3. Check the computed styles for top/left position and visibility.

### Manual Verification
- View the checkout page in the preview with `?mode=app`.
- Inspect the back button to ensure it's clearly visible below the header.
