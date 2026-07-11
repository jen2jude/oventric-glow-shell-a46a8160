## 1. Fix mobile profile "scramble"

The horizontal scanline/tear seen in the screenshots is the profile banner. The current header uses a fixed-height gradient banner with `bg-fixed` / heavy backdrop-blur behind translucent cards, which on mobile Chrome produces the striped artifact (a known GPU compositor issue with `background-attachment: fixed` + blur on scroll).

- In `src/routes/profile.$id.tsx` replace the banner background with a static gradient (no `bg-fixed`, no blur underlay on the banner itself).
- Reduce `backdrop-blur-*` to `backdrop-blur-sm` on cards that overlap the banner, and swap the mobile hero to a solid dark surface with a thin gradient accent.
- Add `overflow-x-hidden` on the profile page wrapper and re-verify no drawer bleeds in on swipe.

## 2. Data model: Circles become groups, add Follows

New tables (all with GRANTs + RLS):

```text
circles                id, owner_id, name, slug, description, avatar_url, is_private, created_at
circle_members         circle_id, user_id, role ('owner'|'admin'|'member'), joined_at
circle_join_requests   id, circle_id, requester_id, status ('pending'|'accepted'|'declined'), created_at
follows                follower_id, followee_id, created_at        (only exists once accepted)
follow_requests        id, requester_id, target_id, status, created_at
```

The existing 1:1 `circle_requests` table stays untouched (legacy) but is no longer read by the UI. All new code targets the new tables. Notifications trigger extended: `follow_request`, `follow_accepted`, `circle_join_request`, `circle_join_accepted`.

RLS summary (plain English):
- Anyone signed in can read circles marked non-private; private circles readable only by members.
- Only the circle owner/admins can accept/decline join requests, edit the circle, or remove members.
- Follow requests: only requester and target can read their own row. Follows row created only on accept (by target).

## 3. Server functions

New file `src/lib/follows.functions.ts`:
- `sendFollowRequest({ targetId })`
- `acceptFollowRequest({ requesterId })` / `declineFollowRequest`
- `unfollow({ targetId })`
- `getFollowStatus({ targetId })` → `'none' | 'pending' | 'following' | 'follows_you' | 'mutual'`
- `listFollowers({ userId })`, `listFollowing({ userId })`
- `listSuggestedFollows({ limit })` – ranked by shared circles + reputation, for the feed strip.

New file `src/lib/circles-groups.functions.ts`:
- `createCircle`, `updateCircle`, `deleteCircle`
- `listMyCircles`, `listCirclesForUser({ userId })` – used by the "Join a circle" picker
- `requestJoinCircle({ circleId })`, `cancelJoinRequest`, `leaveCircle`
- `listIncomingCircleJoinRequests` (for owner/admin)
- `acceptJoinRequest`, `declineJoinRequest`

Old `src/lib/circles.functions.ts` kept only for the legacy inbox until UI is fully migrated, then removed.

## 4. UI wiring

Profile page (`src/routes/profile.$id.tsx`) — viewing another user:
- Primary CTA: **Follow** (green) — states: Follow / Requested / Following / Mutual.
- Secondary CTA: **Join a Circle** (outlined) — opens a modal listing that user's circles; each row has its own request button. Only rows where target is owner/admin are actionable-to-that-admin, but any circle they belong to appears.
- Tertiary: **Chat**, **Report** unchanged.
- New tabs under the header: **Followers · Following · Circles** with counts and scrollable lists.
- Own profile: none of the above; show "This is your profile" pill + "Edit profile".

Feed (`src/components/oventric/Feed.tsx`):
- Inject a horizontally-scrollable "People to follow" strip after every ~4 posts, populated by `listSuggestedFollows`, each card with an inline Follow button.

Header notification bell:
- New buckets in `NotificationsDrawer`: **Follows** (requests + accepts), and existing **Circles** now shows group-join requests instead of 1:1 requests.
- Circles inbox drawer (`CircleRequestsDrawer`) rewritten to list group-join requests grouped by circle, actionable only where you are owner/admin.

Header: replace the existing "Circle Requests" button with a combined **Requests** menu (Follows + Circles) showing a red dot when any pending exists.

New route `src/routes/circles.tsx` (optional but recommended) — lightweight list of my circles + "Create circle" modal. Reached from sidebar and profile.

## 5. Live realtime

Subscribe with Supabase realtime on `follow_requests`, `follows`, `circle_join_requests` so the bell + profile buttons update without refresh, same pattern already used for DMs.

## Technical details

- Migrations grouped: (a) new tables + RLS + GRANTs, (b) notification triggers, (c) helper functions `is_circle_admin(_uid, _circle)` for RLS reuse.
- All buttons are optimistic with rollback on error, matching existing `Join Circle` pattern.
- Suggested-follows query: recent active users with reputation ≥ 4.0, excluding those you already follow / requested / are yourself; cached 60s server-side.
- Feed strip and profile lists use `useQuery` with `staleTime: 30_000` — no polling, only invalidated by realtime events.
- No changes to auth/billing/wallets; existing `circle_requests` rows are read-only kept for audit.

## Out of scope

- Circle chat / group threads (only join + membership this pass).
- Circle admins beyond the owner (schema supports it; UI to promote comes later).
- Blocking / muting.
