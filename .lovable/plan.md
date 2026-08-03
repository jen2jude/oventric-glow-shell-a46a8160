# Desktop website experience, mobile app experience

Keep the current app-style Home Hub exactly as it is on phones. On desktop (>= 1024px), the home page becomes a proper marketing-style website: marketing navbar, hero, feature blocks, live content rails, trust strip and full footer.

## How it splits

- One route (`/`) renders two different home experiences based on viewport.
- Mobile / tablet (< 1024px): unchanged — Header hub mode, HomeHub tiles, wallet card, MobileNav footer. No regression.
- Desktop (>= 1024px) with `active === "Home"`: hide the app sidebar and hub header, render the new landing page instead.
- Once a desktop visitor enters a section (Market, Academy, Bounties, Wallet, Feed, Circles, Messages), the existing app chrome (Header + Sidebar) returns as today. The landing page is the home surface only.

## Desktop landing page sections

1. Marketing navbar (sticky, transparent to solid on scroll)
   - Logo, links: Market, Academy, Bounties, Circles, Blog, Help
   - Right side: Log in + Get started for signed-out; avatar + "Open app" + wallet chip for signed-in
2. Hero
   - Large headline, subcopy, primary CTA (Get started / Open app) and secondary CTA (Explore marketplace)
   - Product visual: a floating wallet/balance card and tile cluster composed from existing 3D icon assets
   - Signed-in users see their real balance in the hero card
3. Feature blocks
   - Marketplace, Academy, Bounties, Wallet, Circles — alternating two-column rows with icon, copy and a link into the matching section
4. Live content rails (real data, same server functions HomeHub already uses)
   - Fresh in the market (`getDiscoveryFeed`)
   - Learn on Academy (`listCourses`)
   - Open bounties (`getDiscoveryFeed`)
   - Rendered as desktop card grids rather than mobile scroll strips
5. Trust + how it works
   - Stat row (products, courses, bounties, countries covered), 3-step "How it works", cashback/escrow assurance strip
6. Footer
   - Column links: Product (Market, Academy, Bounties, Circles, Wallet), Company (About, Blog, Advertise, Affiliate), Support (Help, FAQ, Report a problem), Legal (Terms, Privacy)
   - Logo, short blurb, currency/country chip, copyright

## Design

Same dark premium palette already in use (`#121214` base, elevated `#1E1E24` cards, emerald accents, subtle RGB edge glow). Website feel comes from wider max-width (1200px), generous section padding, larger type scale and calmer density — no new colour system, no new fonts.

## Technical notes

- New components under `src/components/oventric/desktop/`: `DesktopHome.tsx`, `SiteNavbar.tsx`, `SiteFooter.tsx`, plus section subcomponents.
- Viewport split uses a `useIsDesktop()` hook mirroring `use-mobile.tsx` (matchMedia at 1024px), rendered after hydration so SSR output stays stable; mobile markup is the SSR default.
- Data reuse: `getDiscoveryFeed`, `listCourses`, `getWalletBalances`, `getMyFullProfile` via `useServerFn` — no new server functions, no schema changes.
- Prices continue through `safeFormatDisplayPrice` / `formatMoney` with the user's home currency, so the global catalogue rule is preserved.
- `src/routes/index.tsx`: hide `Sidebar` and hub `Header` when desktop + Home; keep all existing deep-link, resume-bounty and section-counter logic untouched.
- `MobileNav` stays hidden on desktop as today.
- Head metadata on `/` updated with landing-appropriate title/description plus og:type and twitter:card.
