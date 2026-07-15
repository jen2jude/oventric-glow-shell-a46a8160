
# Expand Dashboard into a Full User Hub

Today `/dashboard` has three tabs: **Digital Purchases**, **Contacted Sellers**, **My Listings**. That only covers marketplace. Let's turn it into the user's ecosystem cockpit by adding tabs for the other activities they already perform on the platform, all wired to real data (no mocks).

## New tabs to add

1. **Overview** (new default landing tab)
   Snapshot cards with counts + quick links:
   - Wallet available balance (locked currency)
   - Digital purchases · Physical contacts
   - Active listings · Pending · Rejected
   - Bounties posted · Bounties solved · Total earned from bounties
   - Courses enrolled · Courses completed · Courses published
   - Followers · Following · Circles joined
   - Unread messages · Unread notifications

2. **Bounties** (two sub-tabs)
   - **Posted by me** — pulls `bounties` where `poster_id = me`. Shows status (active/paused/closed), price, applicants count, deadline. Actions: view, pause/resume, close.
   - **Solved by me** — pulls closed bounties where I was the solver (via `audit_logs` `bounty.payout` meta.solver_id, or a new `bounty_solutions` link if it exists — I'll check during build). Shows payout amount and date.

3. **Courses** (two sub-tabs)
   - **Enrolled** — `course_enrollments` for me, with progress % from `course_progress`, resume link, completion badge.
   - **Published** — `courses` where `instructor_id = me` (or equivalent), with enrollment count, revenue earned, status (draft/published).

4. **Wallet & Earnings** (compact view; deep link to full Wallet)
   - Available + escrow balances per currency
   - Last 10 `wallet_transactions`
   - Pending `payout_requests` with status
   - Quick actions: Top up · Request payout

5. **Social** 
   - Followers list · Following list · Circles I'm in / I own
   - Pending follow requests + pending circle join requests (incoming if I'm target/owner)

6. **Digital Purchases** (existing — keep)
7. **Physical Contacts** (existing — keep)
8. **My Listings** (existing — keep)

## Layout

Sidebar-style tab list on desktop (left rail), horizontal scroll pill tabs on mobile, matching existing dashboard visual language. Overview cards use the same neon-ring style as feed badges.

## Data sources (all existing, no schema changes needed)

- `bounties` — filter by `poster_id` (posted) and `audit_logs` (solved). I'll verify during build whether a direct solver column exists; if not, the audit log path is authoritative because `adminPayoutBounty` writes solver_id there.
- `course_enrollments`, `course_progress`, `courses`
- `wallets`, `wallet_transactions`, `payout_requests`
- `follows`, `follow_requests`, `circles`, `circle_members`, `circle_join_requests`
- `direct_messages` (unread count), `notifications` (unread count)

All reads go through new server functions in `src/lib/dashboard.functions.ts` gated by `requireSupabaseAuth` so RLS applies as the user. No new migrations.

## Files touched

- New: `src/lib/dashboard.functions.ts` (overview stats, bounties-by-me, courses-by-me, social summary)
- Edited: `src/routes/dashboard.tsx` — add tabs, overview cards, sub-tab panels
- Small additions: query helpers may reuse existing functions in `bounties.functions.ts`, `academy.functions.ts`, `wallet.functions.ts` where they already return the right shape

## Out of scope

- No changes to bounty/course/wallet business logic — dashboard only reads.
- No new database tables or RLS policies.
- Blog authoring stays admin-only (unchanged).

Reply **go** to build, or tell me which tabs to drop / reorder / rename before I start.
