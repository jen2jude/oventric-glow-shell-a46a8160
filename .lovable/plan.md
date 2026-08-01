# First-Launch Feature Carousel

## Goal
Show a lightweight, skippable visual carousel the very first time a user opens Oventric (no local cache). After the carousel, route to the newsfeed/home. Returning users skip it entirely.

## Product decisions
- **Trigger:** localStorage flag `oventric:seen-feature-carousel`. If missing, show carousel.
- **Skippable:** always-visible "Skip" / "Get started" button.
- **Slides:** 5 visuals matching Oventric's pillars — Feed, Marketplace, Academy, Bounties, Wallet.
- **Design:** full-screen dark overlay, simple slide transitions, no heavy blur/backdrop-filter to stay GPU-safe.
- **Auth behavior:** carousel runs before auth gate; users land on it cold, then proceed to sign-in or newsfeed.

## Implementation steps

### 1. Create the carousel component
- File: `src/components/oventric/FeatureCarousel.tsx`
- Props: `onComplete: () => void`
- State: current slide index, direction, touch swipe offsets
- Uses existing 3D/brand assets where possible (feed, marketplace, academy, bounties, wallet asset JSONs) or Lucide icons as fallback.
- Each slide: icon/illustration, headline, one-line description, dot indicator.
- Controls: previous/next chevrons, skip top-right, progress dots, swipe gestures for mobile.
- Animation: simple CSS translate + opacity transitions; respect `prefers-reduced-motion`.

### 2. Add first-launch detection hook
- File: `src/hooks/useFirstLaunch.ts`
- Reads/writes `oventric:seen-feature-carousel` in localStorage.
- Returns `[show, markSeen]`.
- SSR-safe: defaults to `false` on server, hydrates from storage on mount.

### 3. Mount carousel in the root route
- File: `src/routes/__root.tsx`
- Render `<FeatureCarousel />` inside `RootComponent` after providers but before `<Outlet />`, gated by `useFirstLaunch`.
- On completion, call `markSeen()` and let `<Outlet />` render the normal route.
- Ensure it sits above `BootSplash` visually (or wait for boot splash to finish before showing carousel).

### 4. Update home route head metadata
- File: `src/routes/index.tsx`
- Keep existing meta; no change needed unless we want a dedicated `/welcome` route.
- **Decision:** keep carousel as an overlay on `/` so there is no URL change; simpler and avoids back-button issues.

### 5. Add CSS tokens for safe transitions
- File: `src/styles.css`
- Add `.feature-carousel` utility classes with GPU-safe transforms (`transform`, `opacity`) and no `backdrop-filter`.
- Add reduced-motion fallback that disables slide animation.

### 6. Add a persistent backend flag (optional but recommended)
- Add column `has_seen_feature_carousel` to `profiles` table with default `false`.
- Update on carousel completion for authenticated users so the flag survives across devices.
- For anonymous/not-yet-signed-in users, localStorage remains the source of truth until they create an account.

### 7. Test and verify
- Unit test `useFirstLaunch` hook behavior.
- Playwright test: first visit shows carousel, clicking "Get started" hides it, reload no longer shows it.
- Mobile swipe test and reduced-motion test.

## Files to create/modify
- `src/components/oventric/FeatureCarousel.tsx` (new)
- `src/hooks/useFirstLaunch.ts` (new)
- `src/routes/__root.tsx` (modify to mount carousel)
- `src/styles.css` (add carousel-safe transition utilities)
- Migration: add `profiles.has_seen_feature_carousel boolean default false` and RLS policy (optional)

## Out of scope
- Deep-linking to specific slides.
- Video backgrounds or WebGL effects.
- Replacing the existing onboarding stage modals.

## Acceptance criteria
- [ ] First visit on a fresh browser shows the carousel before the newsfeed.
- [ ] Users can skip the carousel at any time.
- [ ] After completion/skip, the carousel never appears again on that device/account.
- [ ] Carousel is responsive and GPU-safe on low-end mobile devices.
- [ ] Returning users see the newsfeed immediately.