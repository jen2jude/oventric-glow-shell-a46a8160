# Plan - Fix Search Bar Overlay Issue

The user reports that clicking the main search bar (near the notification bell) results in nothing being seen, suggesting it's rendering behind other page elements.

## Investigation
1. **FeedAppChrome.tsx**: The search button toggles `searchOpen`.
2. **Feed.tsx**: When `searchOpen` is true, it renders `FeedSearchBar` and `FeedGlobalResults`.
3. The current structure in `Feed.tsx` places `FeedSearchBar` inside a `div` that is part of the normal flow, but `FeedAppChrome` is `sticky top-0 z-30`.
4. If the feed content (including the search bar) has a lower z-index or is being covered by the sticky header, it won't be visible.
5. `FeedGlobalResults` renders a full-screen search results hub (`min-h-screen bg-[#0A0A0B]`).

## Proposed Fix
1. Increase the `z-index` of the search overlay components in `Feed.tsx` when `searchOpen` is true.
2. Ensure `FeedSearchBar` and `FeedGlobalResults` are positioned correctly relative to the sticky header.
3. Add a high z-index container for the search surface to ensure it sits above the feed posts and other UI elements.

## Steps
1. Modify `src/components/oventric/Feed.tsx` to wrap the search-related components in a high z-index container when `searchOpen` is active.
2. Verify if `FeedGlobalResults` in `src/components/oventric/feed/FeedSearch.tsx` needs any z-index adjustments to ensure it covers the screen correctly.
