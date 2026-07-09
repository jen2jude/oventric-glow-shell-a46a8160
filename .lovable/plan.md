
## Goal

Every gated action (post/comment/like, messages, circles, marketplace buy, academy learn, bounty, wallet) opens the **Connect** modal for guests. New users verify email via OTP → slide-in profile form (full name, password, country) → RGB neon splash. Returning users sign in with email + password. Wallet view/fund/withdraw triggers **KYC face liveness** (first time: capture + save; subsequent withdraws: recapture + visual match confirmation).

## 1. Schema changes (migration)

Add to `public.profiles`:
- `country text`
- `phone text`
- `kyc_selfie_path text` (Storage path to the reference selfie)
- `kyc_completed_at timestamptz`
- `profile_completed_at timestamptz` (marks that name+password+country were saved)

New private Storage bucket `kyc-selfies` with RLS: users can only read/write their own folder `{user_id}/*`.

## 2. Auth flow refactor (`AuthGateProvider`)

Replace current tabbed OTP-only modal with a two-track flow:

**New user track (default tab):**
1. Enter email → `signInWithOtp({ shouldCreateUser: true })` (magic link kept as fallback)
2. Enter 6-digit code → `verifyOtp`
3. On success, **slide right** to Profile Setup form: `Full Name`, `Password` (min 8), `Confirm password`, `Country` (select)
4. Submit → `supabase.auth.updateUser({ password })` + server fn `completeProfile` writes name/country/`profile_completed_at` to `profiles`
5. RGB neon splash → resolve original action

**Returning user track (tab "Already have an account"):**
1. Email + password fields
2. `supabase.auth.signInWithPassword` → resolve action (no splash; direct pass)
3. Fallback link "Forgot password / use code instead" reverts to OTP

`FullNameGate` is removed — its job is folded into the new profile-setup slide, which only shows when `profile_completed_at` is null.

## 3. Universal action gate

Wrap every gated entry point in a single `requireAction(callback)` helper exposed from `OnboardingContext` / `AuthGateProvider`:
- If no session → open Connect modal, run `callback` after verified + profile complete.
- If session but `profile_completed_at` null → open Profile Setup slide directly.
- Else → run `callback`.

Wired into:
- `src/routes/index.tsx` → `+` create button (already partial)
- `Feed.tsx` → comment submit, like button, media attach
- `Messages.tsx` / `MessagesDrawer.tsx` → new thread / send
- `CirclesHub.tsx` / `IncomingCircleInbox.tsx` → join / request
- `Marketplace.tsx` → buy button
- `Academy.tsx` → learn/enroll button
- `Bounties.tsx` → solve / claim
- `Wallet.tsx` and `MobileNav`/`Sidebar` wallet entry → view/fund/withdraw

## 4. KYC face liveness

New component `KycLivenessModal.tsx`:
- Requests `navigator.mediaDevices.getUserMedia({ video: true })`
- 3-second capture → grabs a frame to a canvas → uploads JPEG to `kyc-selfies/{user_id}/reference.jpg` on first run; on subsequent withdraws uploads to `.../attempt-{ts}.jpg`
- Shows both captured selfie and reference side-by-side with a "Does this match?" visual confirmation (per user's answer — demo match)
- On confirm: writes `kyc_completed_at` (first time) and shows "Congratulations, verified" splash; on decline: red "We couldn't match your face — try again" with retry

Server functions in `src/lib/kyc.functions.ts`:
- `startKyc` → returns signed upload URL for reference selfie
- `completeKycReference` → sets `kyc_selfie_path` + `kyc_completed_at`
- `verifyKycAttempt` → records attempt path; returns reference signed URL for visual compare

Wallet actions gate:
- Opening Wallet page or clicking Fund/Withdraw → if `kyc_completed_at` null → run reference-capture flow before showing wallet
- Withdraw button → always runs recapture + visual-match flow before proceeding

## 5. Files touched

**New:**
- `src/lib/kyc.functions.ts`
- `src/components/oventric/KycLivenessModal.tsx`
- `src/lib/auth-gate/ProfileSetupSlide.tsx` (extracted from AuthGate)

**Modified:**
- `supabase` migration (columns + bucket + RLS)
- `src/lib/auth-gate/AuthGateProvider.tsx` — add password flow, profile slide, `requireAction`
- `src/lib/onboarding.functions.ts` — add `completeProfile` server fn
- `src/routes/__root.tsx` — remove FullNameGate provider, mount KYC modal
- `src/routes/index.tsx` — swap `require + ensureFullName` → `requireAction`
- Feed, Messages, Circles, Marketplace, Academy, Bounties, Wallet — wrap actions in `requireAction`
- `Wallet.tsx` — trigger KYC modal
- Remove `src/lib/full-name-gate/FullNameGate.tsx`

## Notes

- Password track requires email confirmation, so signup still goes through OTP first — password is set as part of profile setup via `updateUser` on the already-verified session. This preserves email verification and enables password login on return.
- Face "match" is demo-quality per your choice: user visually confirms match. Selfies stored privately with per-user RLS. No third-party face API, no biometric extraction.
- Existing users without `profile_completed_at` will be shown the profile setup slide on their next gated action (backfill-friendly).
