# Plan: Splash Screen Refinement

The splash screen icons are currently too small (16px) and the splash screen disappears too quickly. This plan increases the icon sizes for better visibility and ensures the splash screen remains visible for at least 5 seconds for a more premium "branded" launch experience.

## Proposed Changes

### 1. `src/components/oventric/BootSplash.tsx`
- Increase icon sizes from `h-4 w-4` to `h-8 w-8` (32px).
- Add a minimum 5-second duration before the splash screen begins to fade out.
- Ensure the progress animation (the "lighting up" of icons) feels smooth over this duration.

### 2. `src/routes/__root.tsx` (Pre-hydration Splash)
- Increase the size of the pre-hydration animated dots from `4px` to `8px`.
- Adjust the pulse animation to be more visible.

## Verification Plan

### Manual Verification
- Launch the app in "standalone" mode (simulated or real PWA launch).
- Observe that the Lucide icons in the splash screen are significantly larger and clearer.
- Verify that the splash screen stays for exactly 5 seconds before fading out.

### Technical Checks
- Verify that `isStandaloneLaunch` logic still correctly gates the splash screen to mobile PWA launches.
- Confirm that the `splashConsumed` flag prevents re-triggers during navigation.
