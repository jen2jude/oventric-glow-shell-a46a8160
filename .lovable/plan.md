# Plan - Update Academy Page App UI

Update the Academy page's native app version to show course fees, improve the trending section, and ensure enrolled course images are visible.

## Proposed Changes

### 1. `src/components/oventric/Academy.tsx`

#### Update `CourseCard` (App Shell version)
- Replace the "...More" placeholder with the actual course fee or "Free".
- Use the `courseDisplayPrice` helper for consistent currency formatting.

#### Update Trending Section
- Add the course fee (or "Free") to the trending section's course cards.
- Place it near the "Start Now" button or title for better visibility.

#### Update "My Enrolled Courses" Section
- Add the course cover image to the enrolled course cards.
- Adjust the layout to accommodate both the image and the progress indicator.
- Use a fallback icon if the cover image is missing.

## Verification Plan

### Manual Verification
- View the Academy page in the app shell (native mobile simulator or browser with `isAppShell` mocked/detected).
- Verify that course grid cards show prices (e.g., "$49.99") or "Free" instead of "...More".
- Verify that the trending section items now display their price/free status.
- Verify that enrolled courses now show their respective cover images alongside progress.

### Automated Verification
- Use a Playwright script to:
  1. Detect the Academy page context.
  2. Verify the absence of the "...More" text in app-shell course cards.
  3. Verify the presence of price-related text (formatted currency or "Free").
  4. Confirm that enrolled course card elements contain an `img` tag with a valid source.
