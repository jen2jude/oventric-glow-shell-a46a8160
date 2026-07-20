# Visual regression suite

Playwright pixel-diff tests that guard against the scrambled-tile
rendering bug seen on low-end Android Chrome (Infinix Note 11i / Mali-G52
MC2 and similar). Every high-risk mobile surface has a spec that captures
element screenshots across six mobile viewports under an Android UA.

If a CSS or component change re-introduces SVG turbulence, backdrop-blur,
animated gradients, or GPU-compositor promotion on one of these surfaces,
the pixel diff trips and CI fails.

## Covered surfaces

| Spec | Surface |
| --- | --- |
| `profile-visual-regression.spec.ts` | Public profile page (header, banner, avatar, reputation, tabs) |
| `feed-visual-regression.spec.ts` | Home feed (composer, first post card) |
| `marketplace-visual-regression.spec.ts` | Marketplace mode switcher and product grid |
| `academy-visual-regression.spec.ts` | Academy landing card |
| `bounties-visual-regression.spec.ts` | Bounties summary and first card |
| `wallet-visual-regression.spec.ts` | Wallet balance card and earnings grid |
| `dashboard-visual-regression.spec.ts` | `/dashboard` overview stat rows |
| `megamenu-visual-regression.spec.ts` | Hamburger MegaMenu, premium **and** low-GPU variants |
| `mobile-nav-visual-regression.spec.ts` | Footer nav + floating create button |

## Running

```bash
# Full suite
bunx playwright test

# One spec
bunx playwright test tests/feed-visual-regression.spec.ts

# Update baselines after an intentional visual change
bunx playwright test -u tests/feed-visual-regression.spec.ts
```

Baselines live next to each spec in `tests/__snapshots__/` (or beside the
spec under the auto-created folder — Playwright's default). Commit them
after seeding.

## When a diff trips

1. Open the HTML report (`playwright-report/index.html`) — it shows the
   expected/actual/diff triple for the failed snapshot.
2. If the change is unintended, that's the bug — fix the CSS/component,
   don't refresh the baseline.
3. If the change is intentional (design refresh, deliberate copy tweak),
   run the spec with `-u` on the same viewport(s), inspect the new
   baseline visually, and commit.

## Authenticated specs

The profile, feed, wallet, and dashboard specs require the managed
Lovable Supabase session. They read `LOVABLE_BROWSER_SUPABASE_*` env
vars via `tests/helpers/visual.ts` and `test.skip()` when the vars are
absent so local runs without a session still pass.
