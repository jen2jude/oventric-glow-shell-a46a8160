# Plan: Oventric Stage 6 — Explore / All Products

Redesign the Oventric Marketplace and Explore experience to support product-first discovery, advanced filtering, and enhanced search.

## User Review Required

> [!IMPORTANT]
> - Should "Recommended Products" at the bottom of the product page be a horizontal rail or a grid?
> - For "Related Products", should we prioritize items from the same seller or similar items across the marketplace?

## Proposed Changes

### Marketplace Discovery Redesign (`src/components/oventric/Marketplace.tsx`)
- **Product-First Discovery:** Ensure the marketplace defaults to showing products across all sellers, supporting the "Show me available products" purpose.
- **Enhanced Search Integration:** Integrate `GlobalSearch` logic for consistent search behavior across names, categories, keywords, and seller names.
- **Mobile Filter Drawer:** Implement a bottom sheet or drawer for advanced filters (Category, Price, Product type, Rating, Seller, Availability) to maintain a clean mobile UI.
- **Sorting Logic:** Add sort options: Recommended, Newest, Popular, Best Selling, Top Rated, Price Low → High, Price High → Low.
- **Conventional Grid:** Transition parts of the full catalogue to a more conventional 2nd grid layout while maintaining Oventric's visual language (`#0A0A0B` and crimson accents).

### Explore Experience Hub (`src/components/oventric/feed/FeedDiscoverExplore.tsx`)
- **Product Hub:** Enhance the "Products" tab in the Explore hub to match the new Marketplace discovery layout.
- **Unified Search:** Ensure the search bar in Explore behaves like a marketplace-wide product discovery tool.

### Product & Seller Connection (`src/routes/product.$id.tsx`)
- **Seller Visibility:** Maintain prominent seller identity while browsing.
- **Related Products Section:** Implement "Similar Products", "Recommended for You", and "More Like This" sections at the bottom of the product page.
- **Cross-Seller Recommendations:** Include related products from other sellers to enhance discovery.

### Component & Library Updates
- **`src/lib/marketplace.functions.ts`:** Update `listProducts` and search functions to support new filter and sort parameters.
- **`src/components/oventric/marketplace-discovery/cards.tsx`:** Ensure card layouts support the new discovery grid requirements.

## Technical Details
- **Filtering:** Use `useMemo` for client-side filtering where feasible, and extend server functions for larger data sets.
- **UI Consistency:** Use `rounded-[10px]` and crimson accents (`#E5484D`) for all new discovery components.
- **Performance:** Implement lazy loading for large product grids to maintain a smooth experience.

## Verification Plan
- **Manual Discovery Check:** Navigate to Marketplace and verify products from various sellers are displayed.
- **Filter/Sort Validation:** Apply filters and sort options, confirming the grid updates correctly.
- **Related Products Check:** Open a product page and verify the recommendation sections at the bottom.
- **Mobile Responsiveness:** Test the filter drawer and grid on mobile viewports.
