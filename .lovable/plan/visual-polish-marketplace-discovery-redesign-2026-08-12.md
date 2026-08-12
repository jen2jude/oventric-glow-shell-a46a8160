# Visual Polish: Marketplace Discovery Redesign

Refine the Marketplace discovery experience by scaling down the Featured Products section for better multi-item visibility and replacing generic identicons with contextually relevant category icons.

## Proposed Changes

### UI & UX Enhancements

#### Featured Products Sizing
- Modify `Marketplace.tsx` to reduce the Featured Product card width from `w-[80%] min-w-[80%]` to `w-[68%] min-w-[68%]`.
- This change will allow approximately **1.5 to 1.7 cards** to be visible on screen, creating a stronger visual affordance for horizontal scrolling.

#### Category Discovery Icons
- Update the horizontal category rail in `Marketplace.tsx` to use the intelligent icon mapping logic from `CategoryDiscoverySheet.tsx`.
- Replace the `dicebear` identicons with `lucide-react` icons that match the category name/slug (e.g., a "Shirt" icon for Fashion, "Smartphone" for Electronics).
- Apply semantic gradient backgrounds to the icon containers based on the category type to match the `CategoryDiscoverySheet` visual language.

## Technical Details

### `src/components/oventric/Marketplace.tsx`
- Replicate or share the `ICONS` mapping and `visualFor` logic from `CategoryDiscoverySheet.tsx`.
- Update the category rail mapping to render the correct Lucide icon and background gradient for each category.
- Adjust the width classes in the Featured rail to improve item density.

## Validation Plan
- Verify horizontal scroll behavior on mobile viewport in the preview.
- Confirm that categories like "Fashion", "Digital Assets", etc., show their respective Lucide icons in the rail.
- Ensure the "All" tab's category rail remains functional and visually balanced with the new sizing.
