# Make Oventric feel like a real app on mobile

Two tracks: (1) turn the mobile web experience into a proper installable app with offline support and native-feeling interactions, (2) add a store-ready native shell so you can ship real iOS/Android builds later.

## 1. Install experience

- Smart "Install Oventric" prompt on mobile: captures the browser install event, shows a branded bottom sheet after the user has engaged (not on first paint), remembers dismissal.
- iOS fallback sheet with illustrated "Share -> Add to Home Screen" steps, since iOS has no install prompt.
- Manifest upgraded: full icon set (192/512 + maskable), `categories`, `orientation: portrait`, `scope`, and app shortcuts (Wallet, Market, Bounties, Post) so long-pressing the home-screen icon shows quick actions.
- Apple splash-screen link tags so the iOS launch screen matches the in-app boot splash instead of flashing white.

## 2. Offline support

- Add `vite-plugin-pwa` (generateSW) producing `/sw.js`, registered from a single guarded wrapper that never registers in dev, in an iframe, or on Lovable preview hosts, and supports `?sw=off` as a kill switch.
- Navigations use network-first, hashed build assets cache-first, images cached with a size cap.
- Offline banner when the connection drops, and an offline fallback screen for uncached routes.
- The existing push service worker (`push-sw.js`) stays untouched and keeps its own scope.

Offline only works on the published app, not inside the Lovable editor preview.

## 3. Native feel on mobile

- Page/section transitions: sections of the home shell cross-fade and slide with direction awareness; route pushes slide in from the right, back slides out.
- Bottom tab bar: active tab icon springs and the label fades, with a moving indicator; the bar hides on scroll-down and reappears on scroll-up.
- Haptics: light vibration on tab switch, button press, toggle, successful payment and error states (via `navigator.vibrate`, silently ignored where unsupported).
- Touch feedback: global press-down scale on buttons/cards, no blue tap highlight, no accidental text selection or double-tap zoom, momentum scrolling, overscroll containment so the page doesn't rubber-band the whole document.
- Pull-to-refresh: custom branded spinner on Feed, Market, Bounties, Wallet and Home, refetching the same queries those screens already use.
- Swipe-back: horizontal edge swipe on detail routes (product, bounty, order, profile, blog) navigates back with a live drag transform.
- Status-bar and safe-area polish so content never sits under the notch or home indicator in standalone mode.
- Respect `prefers-reduced-motion` by disabling the motion parts.

## 4. Store-ready native shell (Capacitor)

- Add Capacitor with iOS and Android platforms configured against the published URL, plus native splash and icon assets generated from your ring logo.
- Native plugins wired: haptics, status bar, splash screen, keyboard handling, share, and push (reusing the existing web-push backend where possible).
- The web code stays the single source of truth — the native shell wraps it.

To actually produce store binaries you'll need to export the project to GitHub, pull it locally, and build with Xcode (Mac required for iOS) and Android Studio. I'll include the exact commands. No store submission happens from inside Lovable.

## Technical notes

- New: `src/lib/pwa/register-sw.ts` (guarded registration), `src/components/oventric/InstallPrompt.tsx`, `src/components/oventric/OfflineBanner.tsx`, `src/lib/haptics.ts`, `src/components/oventric/PullToRefresh.tsx`, `src/components/oventric/SwipeBack.tsx`, `src/lib/motion/appTransitions.ts`.
- Changed: `vite.config.ts` (PWA plugin), `public/manifest.webmanifest`, `src/routes/__root.tsx` (splash link tags, offline banner, SW register, swipe-back wrapper), `src/components/oventric/MobileNav.tsx` (animated tabs + hide-on-scroll), `src/styles.css` (touch/press/safe-area utilities), `capacitor.config.ts` + `package.json` scripts.
- All of the above is mobile-scoped; desktop rendering is unchanged.
- Also fixing the outstanding boot-splash hydration mismatch on `/` as part of this work, since it fights the app-launch feel.
