# Blog CMS + Feed post-action polish

Two parallel workstreams. Both land in one push.

## 1. Blog CMS (admin-only)

### Frontend gate
- Remove "Add Blog Article" from `CreatePanel.tsx` (front-end users lose the option entirely).

### Database (one migration)
- `blog_categories(id, slug UNIQUE, name, sort_order, created_at)`
- `blog_tags(id, slug UNIQUE, name, created_at)`
- `blog_posts(id, author_id → auth.users, title, slug UNIQUE, excerpt, body_html, cover_path, category_id → blog_categories, status ENUM 'draft'|'published'|'scheduled', published_at, scheduled_at, created_at, updated_at)`
- `blog_post_tags(post_id, tag_id, PK composite)`
- `blog_reactions(id, post_id, user_id, reaction, UNIQUE(post_id, user_id))`
- `blog_comments(id, post_id, user_id, author_name, initials, text, created_at, updated_at)`
- `blog-covers` storage bucket (public read).
- RLS:
  - Categories / tags: anon SELECT, admin write.
  - `blog_posts`: anon SELECT where `status='published' AND (published_at IS NULL OR published_at <= now())`; admin full write.
  - `blog_reactions` / `blog_comments`: authenticated write-own; anon read; delete-own.
- Trigger: on publish/schedule transitions, keep `published_at`/`scheduled_at` coherent.

### Admin editor route `src/routes/admin.blog.tsx` (list) + `src/routes/admin.blog.$id.tsx` (editor)
- List: rows with status pill, cover thumb, title, category, date. Buttons: New Post, Edit, Delete.
- Editor (WordPress-like):
  - Title input.
  - Cover image upload (drag/click).
  - Rich body editor: contentEditable + toolbar using `document.execCommand`. Buttons: H1/H2/H3/P, Bold, Italic, Underline, Strike, UL, OL, Link (prompt URL), Insert Image (upload → returns signed URL → insertHTML `<img>`), Quote, Code, Clear.
  - Excerpt textarea (auto-derived if empty).
  - Category select with "+ Add new" inline (creates row).
  - Tags multi-select w/ typeahead + "add new".
  - Status radio: Save as Draft / Publish now / Schedule (datetime picker → `scheduled_at`).
- Server functions in `src/lib/blog.functions.ts`: `listBlogAdmin`, `getBlogAdmin`, `upsertBlogPost`, `deleteBlogPost`, `listCategoriesAdmin`, `upsertCategory`, `listTagsAdmin`, `upsertTag`.

### Public reading route `src/routes/blog.$slug.tsx`
- Renders cover, category, title, published_at, author, sanitised body_html.
- Reactions bar (uses new `blog_reactions`) w/ same 4 emotes as feed.
- Comments section (new `blog_comments`) w/ inline composer.
- Share button (native `navigator.share` w/ clipboard fallback).
- SSR head() sets OG title/description/image from the post row.

### Public list route `src/routes/blog.index.tsx`
- Grid of published posts (cover + category + title + excerpt + date).

### Feed injection
- `listPostsPublic` extended to also return injected blog cards.
- `Feed.tsx`: build a rendered items array. After every 10 social posts, splice in the next unshown blog card. Blog card component: cover + "BLOG • {category}" tag + title (large) + 3-line excerpt + `Read article →` (routes to `/blog/$slug`) + separate row w/ reaction count, comment count, share (all click-through to blog page).

## 2. Feed post polish

### 3-dot menu (replaces Flag icon)
- Extract the fullscreen video 3-dot menu from `VideoPlayerModal.tsx` into a shared `PostActionsMenu` component so it can be reused in `Feed.tsx` post header.
- Menu items wired live:
  - **Interested** → local `oventric:interest` map (post prioritisation later), toast "Got it, we'll show more like this."
  - **Not interested** → mark hidden locally + toast.
  - **Hide post** → add id to `oventric:hidden_posts`; filter out in Feed render.
  - **Save** → add to `oventric:saved_posts`; toast "Saved."
  - **Share** → `navigator.share` w/ clipboard fallback (same as video).
  - **Report** → opens existing `ReportModal`.
- Persist all state to `localStorage`; Feed already respects same pattern (see reported set).

### Fix Share icon (bottom-right of post)
- Currently a dead `<button>`. Wire it to the same `sharePost()` helper.

### Video fullscreen menu
- Deduplicate: video reel uses the same `PostActionsMenu` component so both surfaces stay in sync.

## Technical notes

- Rich text uses `document.execCommand` (works on all modern browsers, no deps). Sanitise output with a whitelist regex before storing — strip `<script>` and `on*=` attributes. Render with `dangerouslySetInnerHTML` inside a scoped `.prose` wrapper.
- Blog cover uploads: signed URL via existing pattern in `SellAssetModal`. Public bucket for covers so OG images work.
- Blog card injection reuses `ResponsiveImage`.
- No changes to onboarding tiers required.

## Out of scope

- Full multi-user blog authorship (only admins).
- Live realtime for blog comments (simple refetch after post).
- Draft autosave.
