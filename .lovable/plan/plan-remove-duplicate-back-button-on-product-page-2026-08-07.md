# Plan - Remove Duplicate Back Button on Product Page

The user reported that the "Back to Marketplace" button appears twice on the product page when accessed via URL (web mode). Investigation shows that `src/routes/product.$id.tsx` contains two identical blocks of code for this button, both conditioned on `!isAppShell`.

## User Review Required

> [!IMPORTANT]
> No critical items require user attention.

## Proposed Changes

### Frontend
- **src/routes/product.$id.tsx**: 
    - Remove the redundant `Back to Marketplace` button block (lines 263-280).

## Verification Plan

### Automated Tests
- Run `bunx vitest run` to ensure no regressions in existing logic (if applicable).
- Execute a Playwright script to:
    1. Navigate to a product page (`/product/some-id`) in a browser environment (simulated web mode).
    2. Count the number of "Back to Marketplace" buttons present.
    3. Verify that only one exists.

### Manual Verification
- Open the preview at a product URL and visually confirm there is only one back button.
