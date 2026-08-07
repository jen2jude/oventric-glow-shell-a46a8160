# Plan: Premium App Checkout Redesign

The goal is to redesign the checkout page for the app version (`isAppShell`) to be more sleek, premium, and distinct from the web/URL version, following the successful full-bleed and compact redesign of the product page.

## Proposed Changes

### 1. UI Architecture & Theme
- **Background**: Deepen the background to `#0A0A0B` (pure black/deep charcoal) for `isAppShell`.
- **Containers**: Remove standard page padding (`px-4 py-6`) and use a native-feeling full-width layout with tighter sectional spacing.
- **Card Design**: Replace standard borders with a very subtle `#16161A` card background and `border-white/5` for a high-end feel.
- **Header**: Use a more compact header or hide the standard header in favor of a native-like absolute back button if it fits the flow better (similar to the product page).

### 2. Streamlined Payment Flow
- **Payment Method Selection**: Redesign the selection buttons to be more compact. Use a horizontal or grid layout if possible to reduce vertical scrolling.
- **Interactive States**: Enhance active states with more refined glows or high-contrast borders rather than just standard colors.

### 3. Order Summary & Action
- **Sticky Footer**: Implement a fixed bottom bar for the "Total" and "Pay" button, ensuring the call to action is always visible, mirroring the product page's native feel.
- **Order Preview**: Make the product preview in the checkout summary more compact and integrated into the layout rather than a large standalone block.
- **Cashback Section**: Refine the cashback toggle to be a sleek, high-end switch or a more integrated compact card.

### 4. Implementation Details (`src/routes/checkout.$id.tsx`)
- Use `useIsAppShell()` to scope all premium redesign changes.
- Wrap sections in `isAppShell` conditionals to toggle between the "Temu-style/Web" light UI and the "Premium Dark" App UI.
- Adjust `methodsForCountry` display logic to be more compact in app mode.

## Verification Plan
- Use the preview mode switcher to verify the "App Version" checkout UI.
- Ensure all payment gateways still function correctly within the new layout.
- Check responsiveness across mobile and tablet viewports in "App Mode".
