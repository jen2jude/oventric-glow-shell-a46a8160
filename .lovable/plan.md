# Plan: Inherit Scroll-to-Top Behavior for Identity Hub Navigation

The goal is to ensure that clicking "Posts", "Services", "Skills", etc., from outside the profile page (e.g., from a product page) not only navigates to the profile with the correct tab active but also scrolls the view so the tab content starts at the top of the viewport, matching the behavior when navigating within the profile page.

## Proposed Changes

### Components

#### `src/components/oventric/ecosystem/CreatorChip.tsx`
- Update `EcosystemLinks` to use a specific target `y` coordinate in the search parameters.
- Since we can't easily calculate the exact `tabsTopY` from an external page, we will use a reasonable default constant (e.g., `450`) for the `y` parameter. The profile page logic already handles restoring this scroll position on load.

### Technical Details

- The profile route (`src/routes/profile.$id.tsx`) uses a `restoreY` variable derived from the `y` search parameter.
- When the page loads, `useScrollRestoration` is called with this `restoreY`.
- By passing a non-zero `y` in the link, the `ProfilePage` component will automatically attempt to scroll to that position once the tab data is loaded.

```typescript
// Proposed change in EcosystemLinks
search={(prev) => ({ ...prev, tab: s.key, pages: 1, y: 450 })}
```

## Verification Plan

### Automated Tests
- N/A (UI behavior check)

### Manual Verification
1. Navigate to a product page.
2. Click on "Posts" or "Services" in the creator chip/ecosystem rail.
3. Verify the browser navigates to the user's profile.
4. Verify the correct tab is active.
5. Verify the page has scrolled down so the tab navigation is near the top of the screen.
