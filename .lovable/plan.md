# Plan: Splash Screen Icon Animation Refinement

Update the splash screen (both pre-hydration and React) to feature a 6-icon sequence that glows in a "ping-pong" (left-to-right-to-left) sweep animation while the app loads.

## Proposed Changes

### 1. Update React Splash Screen
- **File**: `src/components/oventric/BootSplash.tsx`
- **Action**: 
    - Keep the existing `ICONS` definitions.
    - Add a CSS keyframe animation for the "ping-pong" sweep.
    - Apply staggered animation delays to each icon to create the wave effect.
    - Maintain the `shown` (loading progress) logic but use it to modulate the baseline visibility or as a completion signal.

### 2. Update Pre-Hydration Splash Screen
- **File**: `src/routes/__root.tsx`
- **Action**:
    - Update the `ob-icons` container to have 6 elements (one for each icon).
    - Update the CSS to assign the specific brand colors to each dot.
    - Implement the `ob-sweep` keyframe animation that moves the glow back and forth across the 6 dots.

### 3. Styles (Optional if needed in global)
- **File**: `src/styles.css`
- **Action**: Add any necessary global utilities for splash animations if they are reused elsewhere (though component-local is safer for the splash).

## Verification Plan

### Automated Tests
- Check that `src/components/oventric/BootSplash.tsx` and `src/routes/__root.tsx` compile.

### Visual Verification
- Open the preview on a mobile-sized viewport (standalone mode simulation).
- Observe the splash screen:
    - Verify 6 icons/dots are present.
    - Verify the glow sweeps from left to right and then back to left.
    - Verify it persists for at least 5 seconds as requested previously.
