## Goal

Extend the existing Playwright visual-regression setup to cover the other high-risk mobile screens (Feed, Marketplace, Academy, Bounties, Wallet, Dashboard, MegaMenu) so any future CSS/GPU regression that reintroduces scrambled-tile rendering fails CI before it ships.

## Current state (verified)

- `playwright.config.ts` exists, `testDir: ./tests`, `baseURL: http://localhost:8080`.
- `tests/profile-visual-regression.spec.ts` already implements the pattern we want: 6 mobile viewports, Android UA, session restore from `LOVABLE_BROWSER_SUPABASE_*`, animation neutralization, `toHaveScreenshot` with `maxDiffPixelRatio`.
- Only the profile route is covered.

## Changes

### 1. Extract shared helpers

New `tests/helpers/visual.ts` exporting `MOBILE_VIEWPORTS`, `ANDROID_UA`, `restoreSession`, `stabilize`, `dismissProfileSetupDialog`, and a `LOW_GPU_VIEWPORTS` variant that also sets `localStorage['oventric:gpu-mode'] = 'low'` before navigation so the safe/low-GPU fallbacks render deterministically.

Refactor `profile-visual-regression.spec.ts` to import from that helper (no snapshot changes — same file names).

### 2. New spec files, one per surface

Each file loops the shared mobile viewports, dismisses onboarding, stabilizes, scrolls, and takes element (not full-page) screenshots of the parts that historically scrambled:

- `tests/feed-visual-regression.spec.ts` — header, composer row (`+` trigger + avatar), first post card, reactions bar.
- `tests/marketplace-visual-regression.spec.ts` — mode switcher, promoted card (`.rgb-promo-border`), a standard product tile.
- `tests/academy-visual-regression.spec.ts` — Explore Course button, first course card.
- `tests/bounties-visual-regression.spec.ts` — first bounty card, filters bar.
- `tests/wallet-visual-regression.spec.ts` — earnings grid rows (cashback/bounty/affiliate), balance card.
- `tests/dashboard-visual-regression.spec.ts` — overview stat rows, mobile stat row.
- `tests/megamenu-visual-regression.spec.ts` — opens the hamburger, snapshots menu chrome and profile card. Runs twice: once premium, once with `oventric:gpu-mode=low` to lock in the safe fallback layout.
- `tests/mobile-nav-visual-regression.spec.ts` — footer nav strip, floating `+` button (static RGB border).

Selectors: prefer existing `data-testid`s; where a section lacks one, the spec adds a fallback `locator()` by role/text and I'll add missing `data-testid` attributes in the same PR (surgical, presentation only). Missing testids to add: `feed-composer`, `feed-post-card`, `market-mode-switch`, `market-promoted-card`, `academy-explore-cta`, `bounty-card`, `wallet-earnings-grid`, `wallet-balance`, `dashboard-overview`, `mega-menu-root`, `mobile-nav`.

### 3. Snapshot policy

- Element screenshots only, never `fullPage: true` (matches profile spec and the browser-use guidance).
- `maxDiffPixelRatio: 0.02` for chrome, `0.03` for content-heavy sections (matches profile spec).
- Baselines committed under Playwright's default `__snapshots__` folders alongside each spec.
- First CI run for a new spec is expected to fail (no baseline yet). Local `bunx playwright test -u` seeds them; commit and the second run is green.

### 4. Config

`playwright.config.ts` — add:
- `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } }` as the default so specs stay terse.
- `reporter: [['list'], ['html', { open: 'never' }]]`.
- Keep single-project, headless, `baseURL` unchanged.

### 5. Docs

Short `tests/README.md` with: how to run (`bunx playwright test`), how to refresh baselines (`bunx playwright test -u <file>`), and what to do when a diff trips (open the HTML report, check whether it's a real regression or an intentional visual change, then update baselines only after confirming the change is intentional).

## Out of scope

- No CI workflow file changes — the harness already runs Playwright.
- No production code changes beyond adding `data-testid` attributes listed above.
- No new dependencies.

## Files touched

- add: `tests/helpers/visual.ts`
- add: 8 new `*-visual-regression.spec.ts` files listed above
- add: `tests/README.md`
- edit: `playwright.config.ts` (defaults + reporter)
- edit: `tests/profile-visual-regression.spec.ts` (import helpers)
- edit: 6-8 components/routes to add missing `data-testid` attributes
