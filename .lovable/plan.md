# Plan: Temu-style Desktop UI Refinement

The goal is to align the desktop "URL version" (marketing/web view) more closely with the Temu desktop experience, specifically focusing on the header, search bar, user profile, and category sections.

## Proposed Changes

### 1. Global Navigation & Layout Refinement (`src/components/oventric/desktop/SiteNavbar.tsx`)
- **Top Utility Bar**: Add a thin top bar for generic links/promotions (like Temu's "Free shipping", "Return within 90d").
- **Header Structure**:
  - Left: Oventric Wordmark (transparent background).
  - Center: Large, pill-shaped search bar with a prominent search icon button.
  - Right: User profile (avatar + "Orders & Account"), Country/Language selector (flag + "English"), and Shopping Cart icon.
- **Red Brand Section**: Add the distinct Temu-style red band below the main header containing categories and best-selling links.

### 2. Marketplace UI Enhancements (`src/components/oventric/Marketplace.tsx`)
- **Square Edges**: Ensure all product cards use `rounded-none` (square edges) for the Temu aesthetic.
- **Lightning Deals / Clearance**: Introduce specific styled headers for "Lightning Deals" and "Clearance Deals" with countdown timers or "Limited stock" labels.
- **Unified Light Theme**: Hard-code light theme colors (white backgrounds, specific red accents for prices) even for browser visitors.

### 3. Responsive Adaptations
- Ensure these "URL version" changes adapt gracefully to mobile and tablet browser visitors, while keeping the "App version" (HomeHub) distinct for PWA/App users.

## Execution Steps
1. Modify `src/components/oventric/desktop/SiteNavbar.tsx` to implement the new header structure and red category band.
2. Update `src/components/oventric/Marketplace.tsx` to enforce square edges and add "Lightning Deals" style sections.
3. Verify that `useIsAppShell` correctly gates these changes to the browser view.
