# Marketplace Visual Refinement Plan

Adjust the visual scaling of the Featured Product cards and Category icons in the Marketplace to improve horizontal discovery and mobile density.

## User Review Required

> [!IMPORTANT]
> The Featured Product card width will be adjusted to match the Featured Shop card's visual length. Based on current code, the Featured Shop card is full-width (`w-full`), so I will set the Featured Product card to `w-full` (or a similar relative width) to ensure consistency.

## Proposed Changes

### Marketplace Component (`src/components/oventric/Marketplace.tsx`)

- **Featured Product Cards**:
    - Update the width from `w-[68%] min-w-[68%]` to match the visual footprint of a `ShopCard`.
    - If the intention is to show one full card at a time (like the Shop list), I will use `w-full`.
- **Category Shortcuts**:
    - Scale down the category icons from `h-16 w-16` to `h-14 w-14` (or similar).
    - Adjust the horizontal rail padding and gaps so that approximately 5 icons are visible on a mobile screen.
    - Reduce the icon and text size slightly for a tighter fit.

## Technical Details

- **File**: `src/components/oventric/Marketplace.tsx`
    - **Featured Hero section**:
        - Change `w-[68%] min-w-[68%]` to `w-full min-w-full` (to match the full-width list style of shops).
    - **Category rail**:
        - Reduce button container size to `w-[68px]` (approx 1/5th of 390px mobile width minus gaps).
        - Update icon size from `h-16` to `h-[52px]` and icon glyph from `h-7` to `h-6`.

## Validation Plan

- Verify the layout in the preview, specifically checking for the 5-icon visibility on mobile viewports.
- Confirm the Featured Product cards now feel consistent with the Featured Shop cards.
