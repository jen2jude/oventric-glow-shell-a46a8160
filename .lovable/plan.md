# Tier-Based UI Rollback (High-GPU Premium / Low-GPU Safe)

Restore the original animated / rich UI on capable devices while keeping the current flat, safe UI as the default and fallback for weak GPUs. Detection extends the existing `html.low-gpu` boot script in `src/routes/__root.tsx`, with a comprehensive allow/deny list built from your paste.

## Detection Strategy (in `src/routes/__root.tsx` boot script)

Enhance the pre-paint detection so it emits three signals on `<html>`:
- `html.low-gpu` (existing) — safe UI
- `html.high-gpu` (new) — premium UI opt-in
- neither → **default safe** (per your choice for uncertain cases)

Order of checks (first match wins):

1. **Manual override** — `localStorage['oventric:gpu-mode']` = `high` | `low` | unset.
2. **prefers-reduced-motion** → low.
3. **High-end allow-list** (from your paste) — matched against WebGL `UNMASKED_RENDERER_WEBGL` and `navigator.userAgentData` model, e.g.:
   - Adreno 830 / 750 / 740 / 730 / 660 / 650 / 640 / 630
   - Apple A18/A17/A16/A15/A14/A13/A12 GPU
   - Mali-G925 / G720 / Immortalis-G925 / G715 / G710 / G78 (MP14+)
   - Xclipse 920 / 940
   → mark `high-gpu`.
4. **Low-end deny-list** (your medium/low list) — Adreno 512/510/509/508/506/505/504/430/420/418/410/405/308/306, Mali-G72 MP3, G71 MP1/MP2, G52 MP1/MP2, G51, T-series, PowerVR G6xxx / GE8xxx / GX6450, plus Infinix / TECNO / itel / Note 11i UA hints, and hardware fallbacks (deviceMemory ≤ 4 or hardwareConcurrency ≤ 4 on mobile) → mark `low-gpu`.
5. **Default** → no class → safe UI (matches your "safe default when uncertain" choice).

Also set `data-gpu-tier` and `data-gpu-reason` for debugging.

## CSS Tiering (in `src/styles.css`)

Introduce tier-gated variants so components stay one file:

```
.rgb-animated-border { /* full animated RGB gradient border */ }
html:not(.high-gpu) .rgb-animated-border { /* falls back to .rgb-static-border look */ }
```

Same pattern for: animated neon backgrounds, backdrop-filter blur, heavy box-shadow glows, gradient conic animations, `filter: blur()` overlays. Everything defaults to the flat safe styles; `.high-gpu` selectors re-enable the premium look.

## Component Restorations (high-GPU only)

Gate the original premium presentation behind `html.high-gpu` — components don't branch in JS, just swap class names.

1. **Mobile `+` button** — `MobileNav.tsx`
   - High: original animated `rgb-spectrum-shift` rotating gradient ring.
   - Low: current 2px `rgb-static-border`.

2. **Profile avatar rings** — `AvatarImage.tsx`, `ProfileDropdown.tsx`, profile header
   - High: animated RGB ring around profile pic.
   - Low: current neutral 1px outline.

3. **Sovereign Wallet** — `src/components/oventric/Wallet.tsx`
   - High: restore original layered cards, gradient hero, subtle blur, animated balance chip.
   - Low: current flat rows preserved verbatim.

4. **Dashboard overview** — `src/routes/dashboard.tsx`
   - High: restore original KPI cards with gradients / shadows / hover glow.
   - Low: current lightweight flat layout preserved.

5. **Public profile stats block** — `src/routes/profile.$id.tsx`
   - High: restore original horizontal card row (Star rating, Bounties solved, Product rating, Listings, Posts) with icons + gradient tiles.
   - Low: current single-column `MobileRepLine` list preserved.

No behavior/data changes — pure presentation gating.

## Manual Override (unchanged, documented)

Users can force a tier from the browser console:
```
localStorage.setItem('oventric:gpu-mode','high') // or 'low', then reload
```
Useful if the auto-detect misfires on a specific device.

## Verification

- Add a small dev-only debug badge (behind `?gpuDebug=1`) that prints `data-gpu-tier` + `data-gpu-reason` so we can confirm detection on your real devices without shipping visible UI.
- Extend existing Playwright mobile visual specs with a second pass forcing `oventric:gpu-mode=high` to snapshot both tiers for Feed / Marketplace / Profile / Wallet / Dashboard / MobileNav.

## Out of Scope

- No changes to data fetching, RLS, escrow, notifications, or any server functions.
- No new dependencies.

## Technical Notes

- Detection runs before first paint (inline script in `<head>`) so no FOUC between tiers.
- `.high-gpu` is additive: removing the class instantly returns any device to the safe UI, so we can kill-switch remotely by shipping a CSS change if a device slips through.
- The allow-list is regex-based on WebGL renderer strings; unknown Adrenos ≥ 620, Apple A12+, Mali-G7x MP10+ are treated as high, everything else defaults safe.
