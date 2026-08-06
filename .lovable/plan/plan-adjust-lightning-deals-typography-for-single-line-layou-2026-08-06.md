# Plan: Adjust Lightning Deals Typography for Single-Line Layout

Reduce the font size of the "Lightning Deals" heading and adjust spacing to ensure the title and countdown stay on a single line on mobile devices.

## Proposed Changes

### 1. Marketplace Component
- **File**: `src/components/oventric/Marketplace.tsx`
- **Actions**:
    - Reduce the font size of the `h2` ("Lightning Deals") on mobile from `text-lg` to `text-sm` or `text-base`.
    - Reduce the emoji size on mobile from `text-xl` to `text-lg`.
    - Adjust the gap between the title group and the countdown.
    - Remove `flex-wrap` from the container if possible, or ensure it only wraps at extremely small widths.

### 2. Countdown Component
- **File**: `src/components/oventric/LightningCountdown.tsx`
- **Actions**:
    - Ensure the internal elements use consistent small font sizes on mobile to save horizontal space.

## Verification Plan

### Manual Verification
- **Mobile Layout**: Inspect the preview at 320px-390px width.
- **Visual Check**: Verify "Lightning Deals" and the countdown timer are on the same horizontal line.
- **Desktop Layout**: Ensure the desktop view remains large and clear (`sm:text-xl`).
