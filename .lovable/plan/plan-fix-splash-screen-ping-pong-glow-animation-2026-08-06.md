# Plan: Fix Splash Screen Ping-Pong Glow Animation

The user reports that the "ping-pong glow animation" still isn't showing. My previous attempt added animations to both the pre-hydration splash in `src/routes/__root.tsx` and the React splash in `src/components/oventric/BootSplash.tsx`. 

One potential reason it's not visible is that the splash screen logic is gated behind `isStandaloneLaunch()` (PWA mode on mobile) and `max-width: 767px`. If the user is testing on a desktop browser or without standalone mode simulation, they won't see it at all.

However, if they *do* see the splash but the *animation* is broken, it might be due to:
1. CSS variables (`--icon-color` / `--color`) not being correctly applied or resolved in the SVG/Div context.
2. The ping-pong logic (left-to-right-to-left) might be too subtle or the keyframes might have an issue.
3. Hydration mismatch errors (seen in the previous Turn summary) might be interfering with the React mount of the splash.

## Proposed Changes

### 1. Fix Animation Logic in `src/components/oventric/BootSplash.tsx`
- Ensure `--icon-color` is correctly typed and passed.
- Refine the `@keyframes` to ensure the glow is more pronounced.
- Use a simpler approach for the ping-pong sweep if the staggered delays are not enough: use a single animation that covers the entire row, or ensure the current staggered approach is robust.
- **Critical**: I'll add a "ping-pong" effect by adjusting the animation timing and keyframes so it feels like a wave moving back and forth.

### 2. Fix Pre-hydration Animation in `src/routes/__root.tsx`
- Ensure the `ob-sweep` keyframes are correctly defined and that `var(--color)` is working as intended in a raw `<style>` tag.
- Fix the hydration mismatch by ensuring the server-rendered HTML is more stable or by handling the "standalone" check more gracefully.

### 3. Debug Visibility
- I will temporarily relax the `isStandaloneLaunch` check or provide a way to see it for debugging if I suspect the user just can't see the component. (I'll keep the original constraints but verify if they are the blocker).

## Verification Plan

### Automated
- Compile check.

### Visual
- Simulate standalone mobile mode in the preview.
- Check if the icons glow sequentially (1-2-3-4-5-6-5-4-3-2-1).
