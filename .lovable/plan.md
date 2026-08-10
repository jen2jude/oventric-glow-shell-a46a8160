# Plan - Refactor Post Composer UI

Revamp `PostComposerModal.tsx` to mirror the provided high-fidelity reference design.

## Proposed Changes

### UI & Styling
- **Theme**: Apply a pure black/dark-grey theme (#0A0A0B / #141418) to match the mobile app aesthetic.
- **Header**: 
    - Replace the standard header with the reference layout: 'X' icon left, "Drop a post" (or user name) center, and a pill-shaped crimson "Post" button right.
- **Identity Bar**: 
    - Position user avatar, name, and a compact audience dropdown (e.g., "Public v") at the top.
- **Composer Area**:
    - "What's on your mind?" placeholder with crimson cursor/focus.
    - Media preview grid mirroring the reference (rounded rectangles, 'X' overlay, and a '+' add card).
- **Toolbar & Actions**:
    - Add the icon strip (Image, Video, Graph, Emoji, Location, Shop).
    - Implement the "Add to your post" section with list items:
        - Photo / Video
        - Mention People
        - Topic / Hashtag
        - Product from my shop
- **Accents**: Use Crimson (#E5484D) for the primary action button and specific icons (Shop).

### Functionality
- **Mention List**: Ensure the "Mention People" item opens the existing mention search.
- **Media Handling**: Map "Photo / Video" and the toolbar icons to the existing file picker logic.
- **Shop Integration**: Wire "Product from my shop" to open a selector (if shop functionality is available) or a placeholder selector.
- **Hashtags**: Add hashtag support if not already present or wired.

## Verification Plan

### Automated Tests
- Run `vitest` to ensure existing post creation logic (Supabase uploads, server functions) remains intact.

### Manual Verification
- Open the composer on mobile and desktop viewports.
- Check layout parity against `user-uploads://WhatsApp_Image_2026-08-10_at_9.57.15_AM_1.jpg`.
- Verify file selection, mention searching, and audience picking.
- Ensure the "Post" button correctly triggers the upload and optimistic UI flow in the feed.
