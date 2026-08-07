# Plan - Academy UI Refinements

Revert "My Enrolled Courses" to a circular "round design" for the app version while keeping images visible, and display course fees for "Recommended Courses" on the app version.

## Changes

### Academy Component (`src/components/oventric/Academy.tsx`)
- Modify the "My Enrolled Courses" mapping logic for `isAppShell` mode.
- Change the card-based layout to a circular thumbnail layout.
- Include a circular progress ring around the course thumbnail.
- Display the course title below the circle.
- Maintain the image visibility within the circular design.
- Keep the existing card design for the web version to preserve visual consistency there.

### Academy Recommendations (`src/components/oventric/AcademyRecommendations.tsx`)
- Update the `CourseTile` component for `isAppShell` mode.
- Replace the current "...More" text with the formatted course price (e.g., "Free" or the localized amount).
- Ensure the price uses the `fmtPrice` helper and `baseCurrency` from the context.

## Validation Plan
- Manually check the Academy page in the preview.
- Verify "My Enrolled Courses" shows circular thumbnails with progress rings on the mobile app shell.
- Verify "Recommended Courses" shows prices instead of "...More" on the mobile app shell.
- Ensure the web version remains unchanged or follows its specific design guidelines.
