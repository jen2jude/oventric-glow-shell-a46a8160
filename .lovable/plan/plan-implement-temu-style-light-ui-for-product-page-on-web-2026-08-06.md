# Plan: Implement Temu-style Light UI for Product Page on Web

The goal is to provide a clean, white "Temu-style" UI for the product page when accessed via a browser (PC/Tablet/Mobile URL), while maintaining the "Premium Dark" theme for the App version (Native/Standalone PWA).

## Proposed Changes

### 1. `src/routes/product.$id.tsx`
- **Hook Integration**: Import and use `useIsAppShell` to detect the environment.
- **Conditional Styling**:
    - Update the main container background and text colors.
    - Update the "Back to Marketplace" button styling.
    - Update the product image gallery container and thumbnail borders.
    - Update the product name, category, and vendor link colors.
    - Update the physical product attribute badges (location, condition, etc.).
    - Update the price display block (background, borders, and currency text).
    - Update the quantity input field styling.
- **Prop Propagation**: Pass `isAppShell` to the `ProductRating` component.

### 2. `ProductRating` component (internal to `product.$id.tsx`)
- **UI Adjustments**: Update star colors and review count text to be readable on both light and dark backgrounds.

### 3. `src/components/oventric/ProductComments.tsx`
- **Hook Integration**: Import and use `useIsAppShell`.
- **Conditional Styling**:
    - Update the section header colors.
    - Update the "Write a review" form container (background and border).
    - Update the review textarea and "Post Review" button styling.
    - Update the individual review list cards (background, borders, and text colors).
    - Ensure avatars and flags remain clearly visible.

## Visual Tokens for "Temu Style" (Web)
- **Background**: `bg-[#F7F8FA]` or `bg-white`
- **Text**: `text-slate-900` or `text-slate-700`
- **Cards/Sections**: `bg-white` with `border-slate-200`
- **Accents**: Keep emerald for actions but ensure high contrast.

## Verification Plan
- **Manual Verification**: Check the product page in a normal browser tab to ensure the light UI is active.
- **App Emulation**: Verify that the dark theme is preserved when `isAppShell` is true (e.g., in a standalone window or native build).
- **Component Integrity**: Ensure all functionality (rating, comments, checkout navigation) remains intact across both themes.
