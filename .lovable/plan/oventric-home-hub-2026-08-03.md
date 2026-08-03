# Oventric Home Hub

A fintech-style home screen (OPay energy, Oventric identity) that becomes the first thing users see on every app open, right after the welcome slides. Nothing about existing features changes — the hub is a launchpad into them.

## What the user sees

Top to bottom, on a dark premium surface:

1. **Identity row** — avatar (tap opens profile menu), greeting with the user's name, country flag/currency chip, notifications and messages bells with their live unread badges. Logged-out visitors see a "Connect Account" pill instead.
2. **Wallet card** — hero card with the main balance in the user's home currency, a hidden/show eye toggle, sub-balance chips (Main, Cashback, Bounty escrow), and two primary actions: Add Money and Withdraw. Tapping the card opens the existing Wallet view.
3. **Quick actions strip** — 4 circular actions: Sell, Post, Fund, Bounty. Each opens the flow that already exists.
4. **Feature grid** — the core launchpad. Large rounded tiles, each with its own fluid 3D icon and a one-line label, arranged 4-per-row on mobile and wider on desktop:
   Feed · Marketplace · Academy · Bounties · Wallet · Circles · Messages · Dashboard · Advertise · Affiliate · Blog · Help.
   Tiles carry the same live counters the mobile footer already uses (new posts, new products, etc.).
5. **Promo rail** — horizontally scrollable cards for cashback, featured campaigns and the referral program, reusing existing ad/campaign data.
6. **Live strip** — a compact "what's happening" row: newest marketplace items and trending bounties, tappable straight into the relevant section.

Motion: staggered tile fade-in on load, springy tap scale, subtle sheen on the wallet card. All motion respects reduced-motion and the existing low-GPU safeguards.

## Navigation behaviour

- The hub is the landing view at `/` on every open — after the first-launch welcome slides, and on every subsequent visit.
- Tapping a tile switches to that section in place, exactly as the sidebar and mobile nav do today. No page reload, no route change for in-shell sections; tiles for standalone pages (Dashboard, Advertise, Affiliate, Blog, Help) link to their existing routes.
- A Home entry is added to the sidebar and the mobile footer nav so users can return to the hub from anywhere.
- Existing deep links (`?section=`, `?bounty=`, `?dm=`, `?resume=bounty`) keep working and still bypass the hub straight to their target.

## Technical notes

- New component `src/components/oventric/HomeHub.tsx`, rendered from `src/routes/index.tsx` as the new default `active` state (`"Home"`), alongside the existing Feed/Marketplace/Academy/Bounties/Wallet/Circles/Messages views. The section switch and deep-link effects already in `index.tsx` are extended, not replaced.
- Wallet numbers come from the existing wallet functions and `HeaderWalletChip` currency logic; badges reuse `useSectionLiveCounter`, notifications and message-count hooks already in `Header.tsx`.
- Tile icons reuse the existing 3D asset pointers in `src/assets` (home, wallet, marketplace, academy, bounties, circles, message) via `Icon3D`, with bold Lucide fallbacks for tiles that have no 3D art yet.
- Styling uses existing semantic tokens and the project's dark surface treatment; new keyframes go into `src/styles.css` behind the established reduced-motion / low-GPU guards.
- `src/routes/index.tsx` head metadata is updated to describe the hub.

No database, payment, or business-logic changes.
