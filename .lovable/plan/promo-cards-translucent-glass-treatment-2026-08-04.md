# Promo Cards — Translucent Glass Treatment

## Goal
Replace the current light/white promo carousel cards on the mobile home hub with frosted dark-glass cards that feel integrated with the dark UI but still distinct and premium.

## What will change
- `src/components/oventric/PromoBanners.tsx`
  - Swap the white/grey card background for a translucent dark glass surface.
  - Add a thin border (subtle white/blue) and soft inner blue glow.
  - Keep text white/light so contrast stays high against the dark home hub.
  - Preserve the snap-scroll, auto-advance, dot indicators, icons, and "GO" buttons.
- `src/styles.css`
  - Remove or narrow the existing mobile `.promo-banner-card` light-theme override.
  - Add a targeted glass-card style block scoped to mobile promo cards only.
  - Ensure the rest of the home hub stays in its smooth dark theme.

## Visual spec
- Card background: dark slate/navy at ~60–70% opacity with `backdrop-blur`.
- Border: `border-white/10` to `border-blue-400/20` depending on active state.
- Glow: soft radial blue glow behind/inside the card, low opacity.
- Icon container: keep a tinted translucent surface rather than the dark panel.
- Typography: white headings, slate-300 subtext, blue-300/blue-400 accent text.

## Out of scope
- No changes to home hub layout, quick actions, wallet card, or bottom nav.
- No changes to desktop styling.
- No new functionality or navigation behavior.

## Verification
- Mobile Playwright screenshot of the home hub showing the promo cards as translucent glass panels against the dark theme.
- Confirm text readability and that the cards still auto-scroll and snap correctly.
