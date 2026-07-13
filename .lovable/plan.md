
This is a large feature. I'll ship it in one pass, but flagging trade-offs so you can steer.

## 1. Mobile access to Circles

- Add a **Circles** entry point on mobile in two places:
  - **Mobile header**: shield icon next to the search/notification icons.
  - **User profile page**: a "Circles" chip in the profile action row (both own profile and others').
- On desktop the sidebar already exposes it — no change.

## 2. Kill the mocks, real data everywhere

Replace `MOCK_CIRCLES` / `mockCircles.ts` usage in `CirclesHub.tsx` with real server functions backed by the existing `circles`, `circle_members`, `circle_join_requests`, `posts` tables.

New / expanded server fns in `src/lib/circles.functions.ts`:
- `listCircles({ category?, q?, sort? })` — public + circles the viewer belongs to, with member count, my membership status, category, avatar, banner hue.
- `listTrendingCircles()` — top 8 circles ranked by a composite score:
  - members × 1 + posts_last_14d × 2 + accepted_bounty_reward_usd_30d × 3
  - Split into 3 rails on the hub: **Trending** (composite), **Most Active** (posts_last_14d), **Top Earners** (bounty $ solved by members).
- `getCircle({ slug })` — full detail incl. my role + join status.
- `listCirclePosts({ circleId })` / `createCirclePost` — watercooler feed backed by `posts` with a new `circle_id` column.
- `listCircleMembers({ circleId })` — with each member's follow status vs me (for the "Follow" button per row).
- `listCircleBounties({ circleId })` — bounties posted by any member of this circle, showing accept/apply state.

## 3. Join gating + Code of Conduct

Schema migration:
- Add `circles.code_of_conduct jsonb` — up to 5 admin-authored questions + a kindness pledge string.
- Add `circle_members.coc_accepted_at timestamptz`.
- Add `circle_join_requests.coc_answers jsonb` (populated when the requester answers after approval).

Flow:
1. Non-member visits circle → sees a **"Request to Join"** CTA. Watercooler composer and reactions are disabled with a "Members only" hint.
2. Admin sees the request in the existing Circle Requests inbox and clicks **Accept**.
3. On accept, we don't add them to `circle_members` yet — status becomes `awaiting_coc`. A **notification** is fired with a link that opens the **Code of Conduct modal** (up to 5 questions + kindness statement + "I agree" checkbox).
4. On submit + agree → server writes `coc_answers`, inserts into `circle_members`, sets `coc_accepted_at`. They're now in.
5. Owner/admin can view answers in the Requests drawer.

Admins can edit the CoC questions from a new **"Circle Settings"** sheet (visible only to owner/admin).

## 4. Watercooler upgrades

- Real post composer wired to `createCirclePost` (members only, hard-gated server-side by RLS + membership check).
- Post author name/avatar is clickable → opens the user's profile.
- On profile there's already the DM button, so private chat works out of the box.
- Reactions & comments reuse the existing feed reaction/comment stack (`post_likes`, `post_comments`) filtered by `circle_id`.

## 5. Members & Follow

- **Members tab** (new): grid of members with their reputation badge and a **Follow / Requested / Following** button using the existing `follows.functions.ts`.

## 6. Group Challenges / Bounty Vault

- Bounty Vault tab lists real bounties whose author is any circle member (`bounties` joined via `circle_members`).
- Non-authors see an **"Apply"** button that routes into the existing bounty apply flow — individual, not group. Clear helper text: *"Applications are individual. Discuss strategy in the Watercooler."*

## 7. Shared Resources

Keep the tab, but replace mock resources with a simple list from a new `circle_resources` table (title, url, added_by, created_at). Members can add, admins can pin/delete. If you'd rather I punt on this table for now and hide the tab until v2, say the word.

## 8. Technical

Schema migration in one call:
- new columns on `circles`, `circle_members`, `circle_join_requests`, `posts (circle_id, indexed)`
- `circle_resources` table + RLS + GRANTs
- RLS updates:
  - `posts`: insert allowed only if `circle_id IS NULL` (public feed) or `is_circle_member(auth.uid(), circle_id)` = true.
  - `posts` SELECT for a circle post: only members of that circle (or public if circle is public).
- Trigger to fire `circle_coc_pending` notification when a request is accepted.

Frontend edits:
- Rewrite `CirclesHub.tsx` (drop `mockCircles.ts` usage, keep visual shell).
- New `CircleCoCModal.tsx` and `CoCEditorSheet.tsx`.
- New `CircleMembersTab.tsx`.
- Update `MobileNav`/`Header` to expose the Circles entry point.
- Update `profile.$id.tsx` with a "Circles" chip.

## Open questions before I start

1. **Shared Resources tab** — build the real `circle_resources` table now, or hide the tab until v2?
2. **Watercooler comments** — do you want threaded comments (like the main feed) inside circle posts, or flat comments for v1?
3. **CoC editor** — should new circles auto-seed with 5 default questions I write ("What will you contribute?", "Have you read the pinned rules?", etc.), or start empty and let the owner author them?

If you're good with the defaults (build resources now, threaded comments, auto-seed CoC), just say "go" and I'll ship it.
