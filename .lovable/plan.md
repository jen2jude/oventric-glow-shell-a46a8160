# Redesign Home Hub to Mirror Reference Blueprint

Overhaul the Home Hub (`HomeHub.tsx`) and its child components to match the "Discover Amazing Things" reference image with 100% fidelity. This includes a pure black (#0A0A0B) background, refined typography, a single glassmorphic financial hub, a 2x3 glowing category grid, and specific content rails for "Featured This Week", "What's Moving", and "From Our Community".

## User Review Required

> [!IMPORTANT]
> - The new design uses a compact mobile-first layout with standardized 10px corner radii.
> - "From Our Community" will display recent social posts with simplified interaction metrics.
> - The current multi-slide promo carousel will be replaced/simplified to match the single hero card style in the reference.

## Proposed Changes

### Core UI & Layout
- **HomeHub.tsx**: 
    - Change background to pure black (`#0A0A0B`).
    - Standardize all cards to `rounded-[10px]`.
    - Implement the center-aligned brand header (Logo, Search, Notifications) if not already handled by the app shell.
    - Update hero typography to bold, uppercase italics: "DISCOVER AMAZING THINGS".

### Sections & Components
- **Search Header**: Implement the compact search bar with filter icon (uniform 52px height, subtle borders).
- **Financial Hub**: 
    - Combine balance and sub-wallets into one glassmorphic card.
    - Large bold balance with visibility toggle.
    - "Add Funds" (Crimson) and "Withdraw" (Subtle) buttons in a 2-column layout.
    - 3-column sub-wallet breakdown at the bottom.
- **Explore Categories**: 
    - Rebuild `ExploreCategories.tsx` as a 3-column grid of square tiles.
    - Add color-coded soft glows to category icons.
- **Featured This Week**: 
    - Update `FeaturedProductCard.tsx` to match the reference styling (aspect ratio, text overlays, badge positioning).
- **Community Feed**:
    - Add a "From Our Community" section showing social snippets (avatar, name, time, text, image, simple heart/comment icons).

### Styling
- **src/styles.css**: Add/Update utility classes for Oventric Crimson (#E5484D) and specific glassmorphism used in the reference.

## Verification Plan

### Visual & Layout
- [ ] Compare Home Hub side-by-side with reference image.
- [ ] Verify 10px corner radius consistency across all cards.
- [ ] Ensure typography (italics, bold, uppercase) matches specific headings.
- [ ] Check color fidelity (Pure black background, specific glowing accents).

### Functional
- [ ] Verify navigation from category tiles still works.
- [ ] Ensure "Add Funds" and "Withdraw" buttons trigger correct flows.
- [ ] Test horizontal scrolling on category and community rails.
- [ ] Verify "View All" links navigate to correct sections.
