# Plan: Premium App Product Page Redesign

The goal is to align the `isAppShell` (app) version of the product page with the user-provided reference images. Key focus: full-bleed product image, back button overlay, and floating side-by-side action buttons.

## Proposed Changes

### 1. `src/routes/product.$id.tsx`
- **Full-Bleed Image Layout**:
    - For `isAppShell`, the product image gallery will be refactored to take up the full width (and potentially height of the viewport upper half) without rounded containers or padding.
    - The "Back to Marketplace" button will be moved inside the image container, positioned at the top-left with an absolute position and a glassmorphism/semi-transparent background.
- **Side-by-Side Action Buttons**:
    - Refactor the "Buy Now" and "Chat with seller" buttons to be displayed side-by-side in a fixed bottom bar.
    - Use `sticky bottom-0` or `fixed bottom-0` for this bar to ensure it's always visible without scrolling.
    - Add a gradient or backdrop blur behind the buttons if they float over content.
- **Layout Adjustments**:
    - Tighten the gap between the image and the product info.
    - Ensure typography is compact for the native app feel.

### 2. `src/components/oventric/ProductComments.tsx`
- **Compact Styling**:
    - Ensure the comments section follows the new compact styling for the app shell.

## Verification Plan

### Automated Tests
- Run a Playwright script to verify:
    - `isAppShell` mode renders the buttons side-by-side.
    - `isAppShell` mode renders the back button as an overlay on the image.
    - The sticky footer is present and visible.

### Manual Verification
- Use the preview mode switcher (added in previous turn) to toggle to "App Version".
- Verify the layout matches the provided reference images (WhatsApp Image 2026-08-07 at 1.33.33 AM.jpg, etc.).
