# Plan - Remove Ring Logo from In-App Branding

The user wants to remove the colorful ring logo from the header and splash screens, keeping it strictly as the site icon/favicon.

## Proposed Changes

### Components & Routes

#### [src/components/oventric/Header.tsx](src/components/oventric/Header.tsx)
- Remove the ring logo `ResponsiveImage` from the `LogoImg` definition.
- Simplify the `LogoImg` JSX to only render the Oventric wordmark.

#### [src/routes/__root.tsx](src/routes/__root.tsx)
- Remove the ring logo `img` from the pre-hydration `oventric-boot` splash screen.
- Remove the `.ob-ring-logo` CSS rule from the inline `<style>` block.

#### [src/components/oventric/BootSplash.tsx](src/components/oventric/BootSplash.tsx)
- Remove the ring logo `img` from the React `BootSplash` component.

## Verification Plan

### Automated Tests
- N/A (Visual change)

### Manual Verification
- Launch the app and verify the header only shows the Oventric wordmark (on mobile and desktop).
- Verify the favicon in the browser tab is still the colorful ring logo.
- If possible (via standalone mode simulation), verify the splash screen only shows the wordmark and the animated icons.
