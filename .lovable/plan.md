# Plan: Live Lightning Deals Countdown

Implement a globally synchronized 5-hour live countdown for the Lightning Deals section in the Marketplace, ensuring it fits well on mobile devices.

## Proposed Changes

### 1. New Component: `LightningCountdown`
- **File**: `src/components/oventric/LightningCountdown.tsx`
- **Logic**:
    - Calculate time remaining in the current 5-hour cycle (e.g., cycles starting at 00:00, 05:00, 10:00, etc. UTC).
    - Use `Date.now() % (5 * 3600 * 1000)` to determine the offset in the current cycle.
    - Set up a 1-second interval to update the state.
- **UI**:
    - Replicate the "black box" design for hours, minutes, and seconds.
    - Add responsive adjustments (e.g., smaller padding/text or wrapping for narrow screens).

### 2. Marketplace Update
- **File**: `src/components/oventric/Marketplace.tsx`
- **Actions**:
    - Remove the hardcoded static countdown (lines 333-342).
    - Import and render `<LightningCountdown />`.
    - Refactor the header layout of the section to be responsive (using `flex-wrap` or `flex-col sm:flex-row`).

## Verification Plan

### Manual Verification
- **Countdown**: Verify the timer updates every second and shows reasonable values.
- **Responsiveness**: Check the layout on mobile viewport (390px width) using browser tools to ensure no horizontal overflow or squeezed text.
- **Global Sync**: Verify that refreshing the page results in the same countdown time (not starting from 5:00:00 every time).

### Automated Checks
- Run `lovable-exec build` to ensure no regressions in types or bundle.
