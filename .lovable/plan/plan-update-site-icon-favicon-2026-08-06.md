# Plan: Update Site Icon/Favicon

The user wants to use the uploaded image `One_-_Week_Masterclass_on_Digital_Leadership_Artificial_Intelligence_Turnaround_Management_and_Fellowship_Induction_for_Women_Executives._Doha_Qatar._22nd_to_27th_June_2026-removebg-preview.png` as the site's icon/favicon. This involves updating both the physical files in `public/` (for browsers) and the React components that use the logo.

## User Review Required

> [!IMPORTANT]
> I will replace the existing circular logo icon with the new colorful ring logo provided. This will affect the browser tab icon, the app's splash screen, and everywhere the small icon-only logo is used.

## Proposed Changes

### Assets and Public Files
- [x] Create a CDN asset for the new logo: `src/assets/oventric-favicon-new.png.asset.json` (Done)
- [x] Replace `public/favicon.png` with the new image (Done)
- [x] Replace `public/apple-touch-icon.png` with the new image (Done)

### Code Modifications

#### `src/routes/__root.tsx`
- Update the pre-hydration boot splash icon.
- Replace the colorful SVG icons in the `oventric-boot` div with a single instance of the new logo or update the logic if the user prefers the new logo to be the central element.
- Ensure the `manifest.webmanifest` is consistent (though physical files are already replaced).

#### `src/components/oventric/BootSplash.tsx`
- Update the `ICONS` list or replace the entire icon sweep with the new logo animation if appropriate.
- Given the new logo is a colorful ring, I'll update the splash screen to center this ring.

#### `src/components/oventric/Header.tsx`
- Update the logo mark if it uses a separate icon asset.

## Verification Plan

### Manual Verification
1. Check the browser tab to see if the favicon has updated.
2. Launch the app in "standalone" mode (using Chrome DevTools mobile emulation with "Add to Home Screen" feel) to verify the splash screen.
3. Inspect the `__root.tsx` pre-hydration splash by disabling JavaScript or throttling the network to see the early boot frame.

### Automated Verification
1. Run a Playwright script to capture screenshots of the header and verify the favicon link in the head.
