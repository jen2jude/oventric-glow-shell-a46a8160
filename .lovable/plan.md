# Plan - Update Marketplace Featured Hero Card Typography

Update the `FeaturedHeroCard` in the Marketplace to allow the product name to span two lines while reducing the font size further.

## Proposed Changes

### Marketplace Component
- Modify `FeaturedHeroCard` in `src/components/oventric/Marketplace.tsx`:
    - Change product name `h2` classes:
        - `line-clamp-1` -> `line-clamp-2` (allowing two lines).
        - `text-xl md:text-2xl` -> `text-lg md:text-xl` (making it smaller as requested).

## Technical Details
- Adjust `line-clamp` and `font-size` utilities for the `h2` element in the `FeaturedHeroCard` component.

## Verification Plan
- Check the Marketplace preview to ensure the featured cards allow two lines for long product names.
- Verify the font size is visibly smaller.
