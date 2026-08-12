# Mobile-First UX & Visual Polish Plan

Audit and upgrade the Oventric ecosystem for a premium mobile-native feel. Focus on interactions, layout density, and performance.

## User Review Required
> [!IMPORTANT]
> - Are there specific "swipe" gestures (e.g., swipe to delete, swipe to go back) you expect, or should I focus on standard touch patterns?
> - For "Skeleton States," should I follow a specific shimmering effect or flat-colored placeholders?

## Proposed Changes

### Global UI & Design System
- Enforce `rounded-[10px]` across all remaining components.
- Standardize `#0A0A0B` background and `#E5484D` accent.
- Ensure all touch targets are at least `44x44px`.

### Feed & Social
- **Interactions**: Add subtle pull-to-refresh hints (if possible within web constraints) and ensure horizontal story/discovery rails have smooth overflow scrolling.
- **Visuals**: Tighten spacing between posts, optimize image aspect ratios for mobile verticality.

### Marketplace & Product Discovery
- **Marketplace**: Implement larger "Featured" hero section. Add horizontal category shortcuts with icons. 
- **Top Sellers**: Refine the carousel/grid to feel more like an "Explore" tab.
- **Product Page**: Ensure the fixed bottom action bar is sleek and doesn't interfere with the OS home indicator or app tab bar.

### Profiles & Seller Shops
- **Hierarchy**: Move identity and "Follow/Message" actions to the top.
- **Density**: Use a more compact stat strip.
- **Shop**: Prioritize the seller's brand and featured product before the grid.

### Checkout & Cart
- **Sticky Actions**: Improve the sticky header/footer for one-handed operation.
- **Clarity**: Simplify the layout to focus on the payment action.

### Seller Dashboard
- **Quick Actions**: Use a grid of touch-friendly tiles for common tasks.
- **Insights**: Use compact charts and "at-a-glance" metrics.

## Technical Details
- Use `isAppShell` from `useLaunchContext` to toggle immersive layouts.
- Optimize image loading with `loading="lazy"` and `decoding="async"`.
- Use `backdrop-blur` for sticky headers/footers to maintain depth.
- Implement `Skeleton` components from `@/components/ui/skeleton` for all async data.

## Quality Assurance
- Test on simulated mobile viewports (iPhone/Android).
- Verify scroll performance and layout stability (no shifts).
- Ensure zero "Unauthorized" console errors during pre-hydration.
