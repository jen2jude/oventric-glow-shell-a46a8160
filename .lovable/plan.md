# Plan: Revert Temu-style badges to original Design

The user wants to revert the "Deal", "Ad", "Top Rated" badges and the star rating appearance on product cards back to the original design across all platforms (Web and App). These elements were recently inherited from Temu-style samples.

## Analysis
- **Badges to remove/revert:** "Deal" (orange), "Ad" (red/promoted), "Top Rated" (orange).
- **Star Rating:** Revert from the Temu-style (currently logic for emerald/slate stars) to the previous simple version.
- **Affected Components:** `Marketplace.tsx`, and potentially `AdSlot.tsx`/`AdCard.tsx` if they share similar badge logic.
- **Target Context:** Both `isAppShell` (App) and browser (Web) versions should be reverted.

## Proposed Changes
### `src/components/oventric/Marketplace.tsx`
1.  **ProductCard Component:**
    -   Remove the `<span className="absolute top-2 left-2 ...">Deal</span>` block.
    -   Remove the `{p.promoted && (<span className="...">Ad</span>)}` block.
    -   Remove the `<div className="flex items-center gap-1">...Top Rated...</div>` block.
    -   Simplify the `Star` rating render to not use the conditional `isAppShell` coloring if the previous design was uniform.
2.  **Lightning Deals Section:**
    -   Remove Temu-specific labels if they don't match the original design (e.g., "Only X left" pill if that was Temu-inherited).

## Verification Plan
1.  **Visual Inspection:**
    -   Check the Marketplace in the preview.
    -   Ensure the orange "Deal", red "Ad", and "Top Rated" pills are gone.
    -   Ensure the star ratings look like the original simple design (typically slate/gray).
2.  **Platform Check:**
    -   Switch between Mobile (App) and Desktop (Web) views to ensure consistency as requested.
