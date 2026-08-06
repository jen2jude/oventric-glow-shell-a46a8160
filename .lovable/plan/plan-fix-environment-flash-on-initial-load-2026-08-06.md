# Plan: Fix Environment Flash on Initial Load

The user reports that on the first load via URL (both PC and mobile), the "app version" (HomeHub) is briefly shown before switching to the intended "url page" (DesktopHome). The user prefers the Marketing view (DesktopHome) as the default during load.

## Proposed Changes

### 1. Update Launch Context Defaults
In `src/hooks/use-launch-context.ts`, modify `useIsAppShell` to return `false` while the context is still being determined (`null`). This ensures browser visitors see the marketing content immediately instead of the app hub.

### 2. Verify Home Route Logic
In `src/routes/index.tsx`, the `desktopLanding` logic already relies on `!isAppShell`. By changing the default of `isAppShell` to `false`, `desktopLanding` will default to `true` during hydration, rendering the responsive marketing landing page.

## Verification
- Visit the site in a normal browser tab (desktop and mobile).
- The `DesktopHome` (Marketing) view should be the first thing painted after hydration, without the `HomeHub` (Fintech) appearing first.
- The `BootSplash` in `src/routes/__root.tsx` still handles the PWA launch experience by overlaying a splash screen, so PWA users won't see a "Marketing flash" during their load.
