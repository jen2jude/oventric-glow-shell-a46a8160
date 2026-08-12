# Plan - Marketplace Visual Refinements

The user reported that category icons under the "All" tab are no longer showing and that the featured product hero card is too large. This plan fixes these issues by restoring category icons and adjusting the hero card width to 75% for better "peek" visibility of the next card.

## User Review Required

> [!IMPORTANT]
> - I will be using the generic `LayoutGrid` icon for all categories as a placeholder since specific icons aren't currently mapped to category IDs. If you have specific icons for each category, please let me know.

## Proposed Changes

### Marketplace Discovery

#### [src/components/oventric/Marketplace.tsx]
- Modify the "Horizontal Category Shortcuts" section to ensure icons are rendered correctly.
- Update the Featured Hero card width from `min-w-full` to `w-[75%]` or `min-w-[75%]` so users can see the next card peeking from the side.
- Ensure the `no-scrollbar` rail for featured products has correct snap alignment for the smaller cards.

## Verification Plan

### Automated Tests
- N/A - Visual layout adjustments.

### Manual Verification
- Open the Marketplace in the preview.
- Verify that category icons are now visible in the horizontal rail.
- Verify that the Featured Hero section shows one full card and a portion of the next card (approx 1.5 cards).
- Verify horizontal scrolling and snapping still work smoothly.
