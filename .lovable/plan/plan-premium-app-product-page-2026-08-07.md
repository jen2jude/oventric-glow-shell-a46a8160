# Plan - Premium App Product Page

Enhance the product page for Native App (AppShell) users with a sleek, compact, and premium dark UI.

## Proposed Changes

### 1. Theme & Background
- **Deepened Dark Mode**: Switch `bg-[#121214]` to a richer `#0A0A0B` for the AppShell background to create a more high-end native feel.
- **Subtle Containers**: Use `#16161A` for cards/sections with very fine `border-white/5` borders instead of the current `#1E1E24`.

### 2. Compact Layout & Spacing
- **Reduced Padding**: Tighten the main container padding (`px-4 py-6` -> `px-3 py-4`) for AppShell to feel more like a native view.
- **Smaller Gaps**: Change the main grid gap from `gap-8` to `gap-5` in AppShell mode.
- **Compact Header**: Ensure the header area for the product title and vendor is more integrated and less airy.

### 3. Sleek Interactive Elements
- **Compact Buttons**: 
  - Reduce button heights (`py-3` -> `py-2.5`).
  - Use slightly smaller text (`text-sm` -> `text-[13px]`).
  - Maintain high visibility for the "Buy Now" primary action.
- **Icon Sizing**: Slightly scale down icons within buttons for a more refined look.

### 4. Component Refinements
- **Product Rating**: Make the rating stars and review count more compact.
- **Image Gallery**: Adjust the aspect ratio or rounded corners (`rounded-2xl` -> `rounded-xl`) to look more "modern app".
- **Product Details List**: Flatten the details (location, condition, etc.) into a more compact rail or grid.

## Implementation Strategy
- Use the `isAppShell` flag in `src/routes/product.$id.tsx` and `src/components/oventric/ProductComments.tsx` to conditionally apply these "Premium Compact" styles.
- Preserve the current light-themed "Temu-style" UI for browser/web users as previously requested.

---

*Note: This plan focuses on visual density and high-end aesthetics without changing the core functionality.*
