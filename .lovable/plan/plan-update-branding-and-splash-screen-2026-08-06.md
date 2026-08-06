# Plan: Update Branding and Splash Screen

Update the platform's branding and splash screen with the new colorful glowing ring logo while maintaining consistency across pre-hydration and React-rendered states.

## User Review Required

> [!IMPORTANT]
> The new ring logo will replace the current icon in the header and splash screens. The Oventric wordmark remains.

- **Branding**: Use the new colorful glowing ring logo as the primary mark.
- **Splash Screen**: Update both the server-rendered and React-rendered splash screens to feature the new logo.

## Proposed Changes

### Assets
- Replace `public/favicon.png` and `public/apple-touch-icon.png` with the new colorful ring logo.
- Use the newly created `src/assets/oventric-ring-glow.jpg.asset.json` for in-app React components.

### 1. Root Layout (`src/routes/__root.tsx`)
- Update the pre-hydration `oventric-boot` div to use the new colorful ring logo.
- Ensure the ring logo and wordmark are styled correctly in the initial HTML frame.

### 2. Splash Screen Component (`src/components/oventric/BootSplash.tsx`)
- Update the React `BootSplash` component to use the new colorful ring logo.
- Maintain the animated icon sequence (ShoppingCart, Banknote, etc.) below the main logo.

### 3. Header Component (`src/components/oventric/Header.tsx`)
- Update the site header to display the new colorful ring logo alongside the Oventric wordmark.

## Verification Plan

### Automated Tests
- Run Playwright to verify the splash screen appears on mobile standalone launches and features the new logo.
- Verify the header displays the new logo on both mobile and desktop.

### Manual Verification
- Launch the preview and inspect the header logo.
- Check the `favicon.png` and `apple-touch-icon.png` URLs to confirm they are updated.
