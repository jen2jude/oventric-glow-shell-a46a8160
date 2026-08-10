# Plan - Fix Product Tagging and Post-only-product logic

The user reported that product tagging is not working on mobile after publishing, and specifically mentioned that posts with only products (no text/media) are not being created/viewed correctly. Also, clicking a tagged product should open the user's shop.

## Diagnosis
1.  **Product-only posts**: The current `createPost` server function in `src/lib/posts.functions.ts` has a Zod validator. I need to ensure it allows posts where `text` is empty but `productAttachmentIds` is not empty.
2.  **Rendering**: In `src/components/oventric/Feed.tsx`, I need to verify that `ProductAttachmentCard` is rendered even if there is no text or media. 
3.  **Click behavior**: The user wants clicking a tagged product in the feed to open the product in the user's shop. 
    - `ProductAttachmentCard` currently links to `/shop/$id` with a `productId` search param.
    - `src/routes/shop.$id.tsx` handles this via a `useEffect` that sets a `focalProduct`.
4.  **Image loading**: The user mentioned "ProductAttachmentCard dont show". This could be due to broken image URLs (Supabase storage paths vs absolute URLs). I'll ensure `buildFeedPosts` generates correct public URLs for product covers and vendor avatars.

## Proposed Changes

### Backend (Server Functions)
- **src/lib/posts.functions.ts**:
    - Update `createPost` input validator to allow empty text if products are attached.
    - Ensure `buildFeedPosts` correctly resolves product cover and vendor avatar URLs using public storage paths if they aren't already absolute.
    - Ensure `POST_SELECT` includes all necessary fields for rendering.

### Frontend (Components)
- **src/components/oventric/Feed.tsx**:
    - Ensure the post container handles cases where `text` and `media` are both empty (rendering just the product cards).
    - Double-check the conditional rendering logic for `ProductAttachmentCard`.
- **src/components/oventric/PostComposerModal.tsx**:
    - Update client-side validation logic (`hasBlockingError`) to allow posting if a product is attached, even if no text is present.

## Verification Plan
1.  **Manual Test (Browser)**: 
    - Create a post with ONLY a product attached (no text, no image).
    - Verify it appears in the feed.
    - Click the product card and verify it navigates to the shop with the product in focus.
2.  **Code Review**:
    - Check for missing imports or type errors after the changes.
    - Verify RLS on `post_product_attachments`.
