# Plan: Mirror "Discover Amazing Things" Home Hub Design

Refactor the Home Hub and related components to mirror the user's provided blueprint (marketplace_discovery_ref.png) with 100% fidelity, ensuring the app-like feel, glowing icons, and specific card arrangements are implemented.

## User Review Required

> [!IMPORTANT]
> - I will be using standard icons (Lucide) for categories unless specific custom assets are provided.
> - The layout will prioritize the 2x4 glowing category grid as shown in the reference.

## Proposed Changes

### Home Hub (`src/components/oventric/HomeHub.tsx`)
- Standardize on pure black background `#0A0A0B`.
- Implement the "Discover Amazing Things" hero section with bold, uppercase typography and tight leading.
- Update the Financial Hub card:
    - Single glassmorphic surface with 1px border.
    - Large bold balance display with eye toggle.
    - Compact "Add Funds" (Crimson) and "Withdraw" (Glass) buttons inside the card.
    - 3-column sub-wallet breakdown (Cashback, Bounty, Escrow).

### Explore Categories Grid (`src/components/oventric/hub/ExploreCategories.tsx`)
- Revamp the category tiles into a 2x4 or 3x2 grid of squares.
- Each tile will feature a centered circular icon with a soft glowing background.
- Category colors:
    - Tech: Blue glow
    - Digital Assets: Purple glow
    - Fashion: Rose/Pink glow
    - Academy: Emerald/Teal glow
    - Jobs: Orange/Amber glow
    - AI Tools: Indigo/Blue glow
- Add subtle border radius (10px) and glassmorphic background to each tile.

### Featured Components
- **Featured Product Card (`src/components/oventric/hub/FeaturedProductCard.tsx`)**:
    - Ensure 16:10 aspect ratio.
    - Standardize 10px corner radius.
    - Use bottom-aligned text overlays with Oventric Crimson (#E5484D) accents for ratings.
- **Hub Promo Carousel (`src/components/oventric/hub/HubPromoCarousel.tsx`)**:
    - Update slide styling to match the new bold app aesthetic.
    - Ensure smooth transitions and standardized corner radius.

## Technical Details
- Using Tailwind CSS v4 for all styling.
- Standardizing design tokens (colors, radius, shadows) across the hub.
- Preserving existing data fetching and FX conversion logic.
