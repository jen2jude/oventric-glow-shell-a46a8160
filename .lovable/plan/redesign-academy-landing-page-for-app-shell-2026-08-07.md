# Redesign Academy Landing Page for App Shell

Redesign the Academy landing page in `src/components/oventric/Academy.tsx` to have a premium, native-app feel for `isAppShell` users, following the user's specific layout requirements.

## Proposed Changes

### 1. `AcademyHero` Refactor
- Modify `AcademyHero` to implement a new layout when `isAppShell` is true.
- **Banner Card**: A full-width banner for "Master High-End Digital Skills".
- **Info Row**: A horizontal row below the banner for "100% online & self paced", "Free", and "Certificate on completion".
- **Horizontal Scrollable Rail**: A rail of smaller, slimmer cards for "Video-first delivery", "Auto resume", and "Certificate on completion", each featuring a relevant background image.

### 2. Styling
- Use `#0A0A0B` or pure black background for the app version.
- Ensure 10px rounding (`rounded-xl`) is applied as per previous project instructions.
- Add background images to the scrollable cards using Unsplash URLs.
- Remove redundant borders or padding that might make it look like a web page.

### 3. Verification
- Verify the layout matches the description in the app shell view.
- Ensure the desktop/web version remains unchanged (clean white UI).

## Technical Details
- Use `isAppShell` from `useIsAppShell()` hook.
- Implement conditional rendering inside `AcademyHero`.
- Use `overflow-x-auto` and `scrollbar-none` for the scrollable rail.
