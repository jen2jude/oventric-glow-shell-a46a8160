# Checkout Redesign Plan

Redesign the checkout page (`src/routes/checkout.$id.tsx`) to match the premium, sleek app-like aesthetic of the Oventric marketplace discovery hub.

## Proposed Changes

### 1. Visual Theme & Consistency
- Apply the global `#0A0A0B` background consistently.
- Use uniform `rounded-[10px]` for all cards, buttons, and inputs.
- Switch accent colors from emerald to crimson (`#E5484D`) where appropriate, maintaining premium feel.
- Implement glassmorphism for cards using `bg-white/[0.03]` and subtle borders.

### 2. Layout Refinement
- **Header**: Refine the product summary header to be more compact and integrated.
- **Payment Methods**: Redesign the selection cards to be cleaner, with better spacing and more consistent iconography.
- **Order Summary**: Improve the visual hierarchy of the total price and subtotal breakdown.
- **Fixed Bottom Bar**: Standardize the sticky action bar at the bottom for mobile, matching the product page's sleek style.

### 3. Functional/UX Enhancements
- Improve the transition between payment methods.
- Refine the "Cashback Wallet" section to look less like a standard form and more like a premium feature toggle.
- Clean up the delivery details section with simplified inputs.

## Technical Details
- Update `src/routes/checkout.$id.tsx` to replace `rounded-xl`, `rounded-lg` with `rounded-[10px]`.
- Replace `bg-emerald-500` with `bg-[#E5484D]` (crimson) for primary actions.
- Update conditional logic for `isAppShell` to ensure a unified dark theme experience.
- Refine Tailwind classes for border colors and background opacities (`border-white/10`, `bg-white/[0.03]`).
