# Plan: Stage 10 - Universal Search & Discovery

Building a unified Oventric discovery hub that organizes people, commerce, and content into an intelligent, relationship-driven experience.

## User Review Required

> [!IMPORTANT]
> - The new search will feature more tabs (Shops, Services, Courses, Jobs) than the current "Explore" header. I will align the tabs with the requested list.
> - I will extend the `searchGlobal` server function to include more specific queries for Shops, Services, and Courses.

- [ ] Does the proposed tab order (All, People, Products, Shops, Services, Content, Courses, Jobs) meet your expectations?

## Proposed Changes

### Database & Server Logic
- **`src/lib/search.functions.ts`**:
    - Update `searchGlobal` to return more granular categories.
    - Add specific logic to distinguish between "Shops" (sellers with active products) and "People".
    - Implement filtering for `kind: 'service'` and `kind: 'course'` within the marketplace search.
    - Add basic job search logic (or placeholders if the jobs table is not yet mature).

### Search UI Components
- **`src/components/oventric/search/SearchTabs.tsx`** (New):
    - Unified tab rail following the Stage 10 blueprint.
- **`src/components/oventric/search/ResultCards.tsx`** (New):
    - **PersonCard**: Shows image, name, verification, interests, skills, followers, and "Shop/Services" indicators.
    - **ProductCard**: Replaces generic cards with a discovery-focused version (Price, Seller, Rating, Category).
    - **ShopCard**: Identity-focused card with product count, sales, and follower stats.
    - **ServiceCard**: Contextual card leading to the provider's hub.

### Integration
- **`src/components/oventric/feed/FeedSearch.tsx`**:
    - Refactor `FeedGlobalResults` to use the new unified categories and specialized cards.
- **`src/components/oventric/feed/ExploreHeader.tsx`**:
    - Align tabs with the new universal discovery structure.

## Technical Details
- Use `rounded-[10px]` for all new card designs.
- Maintain the #0A0A0B dark theme with #E5484D crimson accents.
- Ensure "Contextual Discovery" by including deep links (e.g., `Product → Seller Storefront`).
