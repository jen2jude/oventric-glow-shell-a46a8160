# Plan: Fix Profile Section Links in Product Page

The links under the creator's name on the product page currently only navigate to the user's profile overview, ignoring the specific section (Posts, Services, Skills, etc.). I will update the `EcosystemLinks` component to correctly pass the `tab` search parameter so that clicking a section takes the user directly to that tab on the profile page.

## User Review Required

> [!IMPORTANT]
> No critical user review required for this functional fix.

## Proposed Changes

### Components

#### [CreatorChip.tsx](src/components/oventric/ecosystem/CreatorChip.tsx)
- Update `EcosystemLinks` to include the `tab` search parameter in the `Link` component for each section.
- Ensure the `tab` corresponds to the section's key (e.g., `posts`, `services`, `skills`, `courses`, `collections`).

## Verification Plan

### Automated Tests
- I will verify the code changes by inspecting the `Link` component in `CreatorChip.tsx` to ensure `search` is correctly populated.

### Manual Verification
- Navigate to a product page.
- Click on "Posts (count)", "Services (count)", etc., under the creator's name.
- Verify that the browser navigates to the profile page with the correct tab active (e.g., `?tab=posts`).
