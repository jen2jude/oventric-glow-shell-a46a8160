# Plan: Refine Global Search UI to Prevent Full-Screen Bloat

The current global search overlay in the Feed page covers the entire screen without sufficient padding or a clear exit path in certain states. We will adjust the layout to include proper margins/padding and ensure the close button is always accessible and prominent.

## Proposed Changes

### 1. `src/components/oventric/Feed.tsx`
- Update the fixed search overlay containers to include lateral padding/margins so they don't feel like they "swallow" the entire app.
- Ensure the floating close button is consistently positioned and highly visible.
- Add a background blur or semi-transparent overlay to the backdrop to maintain context while focusing on search.

### 2. `src/components/oventric/feed/FeedSearch.tsx`
- Adjust `FeedGlobalResults` to have a max-width and centered layout on larger screens, with side padding on mobile.
- Refine the `ExploreHeader` or the search results container to respect safe areas and avoid edge-to-edge content.

### 3. `src/components/oventric/Header.tsx`
- Add an explicit close button to the mobile search overlay if it's missing or obscured.

## Validation Plan
- Use Playwright to verify that the search overlay has visible space around its edges (padding/margins).
- Verify that the "X" close button is visible and functional in all search states (empty, loading, and with results).
- Check responsiveness on simulated mobile viewports.
