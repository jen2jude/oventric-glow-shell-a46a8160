# Plan: Clean White UI for Academy Page (Web/URL Access)

Inherit the clean white UI patterns for browser/URL visitors on the Academy page, ensuring consistent typography, readability, and platform-specific aesthetics (Dark for App, White for Web).

## User Review Required
> [!IMPORTANT]
> - Should the course detail view (video player area) also be pure white for web, or should we keep the video container dark for a "cinema mode" feel even on the white theme?

## Proposed Changes

### 1. Academy Main Components (`src/components/oventric/Academy.tsx`)
- Update `Academy` container to be `bg-white` and `text-slate-900` when `!isAppShell`.
- Apply `md:bg-white` pattern to all sub-components (`AcademyHero`, `CourseCard`, `CourseDetail`) but generalize it for all browser visitors (not just `md:`) using `isAppShell`.
- Standardize colors: `text-white` -> `text-slate-900` for headings, `text-slate-400` -> `text-slate-600` for body text on web.
- Ensure category buttons and inputs use the high-contrast slate theme on web.

### 2. Academy Recommendations (`src/components/oventric/AcademyRecommendations.tsx`)
- Update `SectionHeader`, `CourseTile`, `ProductTile`, `BountyTile`, `CircleTile`, and `BlogTile` to support the white theme for URL visitors.
- Use `isAppShell` to toggle background/border colors (e.g., `bg-white border-slate-200` for web vs `bg-[#1E1E24] border-white/10` for app).

### 3. Layout and Header Integration
- Ensure the `Header` is correctly configured to show the `SiteNavbar` (white header) for URL visitors via the existing `forceSiteNavbar` prop in the routing layer if needed.
- Verify that `Academy` page within `src/routes/index.tsx` (when active) respects the white theme constraints.

## Verification Plan

### Manual Verification
- View the Academy page via a browser (URL access).
- Confirm the background is pure white (`#FFFFFF`).
- Check that all text is dark slate and readable.
- Confirm icons (Lucide) have appropriate contrast.
- Inspect the course detail view and curriculum list for theme consistency.

### Automated Tests
- Run `lovable-exec test` to ensure no regressions in academy logic.
- Verify `isAppShell` logic correctly toggles classes.
