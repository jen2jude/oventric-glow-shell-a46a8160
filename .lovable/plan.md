# Plan - Refine Marketplace Featured Hero Card

Redesign the `FeaturedHeroCard` in the Marketplace to have a single-line product name, smaller font, and a 50/50 split with a full-cover image on the right.

## Proposed Changes

### Marketplace Component
- Modify `FeaturedHeroCard` in `src/components/oventric/Marketplace.tsx`:
    - Change product name `h2` classes:
        - `line-clamp-2` -> `line-clamp-1`.
        - `text-2xl md:text-3xl` -> `text-xl md:text-2xl`.
    - Change image classes:
        - `object-contain object-right` -> `object-cover`.
    - Ensure the split is visually equal (both sides are `flex-1`, which is correct, but removing the absolute right alignment on the image if it's going to be cover).

## Technical Details
- Update `FeaturedHeroCard` internal layout.
- Use `line-clamp-1` for the product title.
- Adjust font sizes for mobile and desktop views.
- Switch image fitting from `object-contain` to `object-cover`.

## Verification Plan
- Check the Marketplace preview to ensure the featured cards show a 50/50 split.
- Verify the product name is limited to one line.
- Confirm the image fills the entire right half of the card.
