# Plan: Revamp Home Hub to Mirror Reference Design

The objective is to overhaul the `HomeHub` (and related sub-components) to exactly match the provided visual blueprint (`image_8.png` / `ChatGPT_Image_Aug_15_2026_11_52_50_AM.png`). This includes a high-end "O-brand" aesthetic with specific icons, glowing effects, and a refined grid layout.

## User Review Required

> [!IMPORTANT]
> - The new design introduces a specific set of category icons (Tech, Fashion, Home & Living, etc.) as seen in the image. I will implement these as a standardized `ExploreCategories` component.
> - The search bar will be updated to match the reference (search products, shops, people...) with a filter icon on the right.
> - I will use the established crimson accent (#E5484D) for all "active" states and "glowing" effects to maintain brand consistency while matching the UI arrangement.

## Proposed Changes

### 1. Home Hub Core (`src/components/oventric/HomeHub.tsx`)
- Redesign the greeting section to be more compact as shown in the mockup.
- Update the **Financial Hub** card:
  - Single card with a bold balance.
  - Simplified sub-chips (Cashback, Bounty, Escrow).
  - Clean action buttons (Add, Withdraw, Send) with matching icons.
- Implement the **Explore Categories** rail:
  - 1x6 grid of circular icons (Tech, Fashion, Home & Living, Digital Assets, Courses, Jobs).
  - Add "NEW" badges where appropriate.
- Update the **Featured This Week** rail:
  - 3-column grid of product cards.
  - Labels like "Best Seller", "Digital", "Trending".
- Implement the **What's Moving** rail:
  - Darker cards with glowing icons/images.
  - "X.k sold" indicator.
- Revamp the **Community** feed preview:
  - Clean user post card with verified badge, relative time, and interaction metrics.

### 2. Marketplace & Discovery Components
- Update `src/components/oventric/Marketplace.tsx` to include the new circular category icons at the top.
- Refactor card components in `src/components/oventric/marketplace-discovery/cards.tsx` to match the specific rounded corner and glow styles from the image.

### 3. Styling & Assets
- Define new color tokens if necessary for the specific glow effects (purple, green, orange accents).
- Standardize spacing to match the high-density but clean look of the reference.

## Technical Details
- Use `lucide-react` for standard icons and custom SVGs/Gradients for the "3D" glowing category icons.
- Ensure all prices continue to use the `computeDisplayPrice` logic for local currency conversion.
- Maintain existing auth gates and interaction logic.

## Verification Plan

### Manual Verification
- View the home hub on mobile and desktop viewports to ensure the 2x4 grid and rails are responsive.
- Verify that clicking category icons filters the marketplace correctly.
- Check the financial hub balance visibility toggle.

### Automated Tests
- Run `lovable-exec test` to ensure no regressions in routing or data loading.
