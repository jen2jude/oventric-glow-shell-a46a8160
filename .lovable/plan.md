# Plan: Fix Environment Flash on Initial Load

The user reports that on the first load via URL (both PC and mobile), the "app version" (Fintech HomeHub) is briefly shown before switching to the intended "url page" (Marketing DesktopHome). 

This happens because `useIsAppShell` (which drives the decision in `src/routes/index.tsx`) defaults to `true` while hydration is pending. This was intended to prevent a flash of marketing content on slow-loading native apps, but it causes the inverse flash on browser loads.

## Proposed Changes

### `src/hooks/use-launch-context.ts`

- Refactor `useIsAppShell` to return `null` (or an object with a loading state) during hydration so that the consumer can decide how to handle the "unknown" state.
- Alternatively, and more simply for this architecture: provide a new hook `useIsBrowser` that defaults to `false` but allows the landing page to wait for the real context before rendering.

Wait, looking at `useLaunchContext`: it already returns `null` until hydration.
The problem is `useIsAppShell`:
```typescript
export function useIsAppShell(): boolean {
  const ctx = useLaunchContext();
  // Unknown (pre-hydration) keeps the existing app markup, avoiding a flash.
  return ctx === null || ctx === "native" || ctx === "standalone";
}
```
It explicitly treats `null` as `true`.

### `src/routes/index.tsx`

- Use `useLaunchContext` directly instead of the boolean `useIsAppShell`.
- If `ctx === null` (hydration pending), render a neutral state or the server-safe default.
- Since we want the Marketing page to be the SEO/Browser default, we should ideally default to the "browser" view during SSR/hydration if we want to avoid the app flash on web.

## Plan

1. **Modify `src/hooks/use-launch-context.ts`**:
   - Update `useIsAppShell` to be more explicit or add a `useLaunchContext` check that doesn't assume "app" during hydration.
   - Actually, I will change `useIsAppShell` to return `false` on `null` if we want to favor the web version, OR better: update `src/routes/index.tsx` to handle the `null` state explicitly.

2. **Modify `src/routes/index.tsx`**:
   - Change `const isAppShell = useIsAppShell();` to use `useLaunchContext()`.
   - Update the `desktopLanding` logic:
     ```typescript
     const launchCtx = useLaunchContext();
     // If we are still hydrating (null), default to browser view on web URLs to avoid the "App flash".
     const isApp = launchCtx === "native" || launchCtx === "standalone";
     const desktopLanding = active === "Home" && (isDesktop || !isApp);
     ```

3. **Verification**:
   - Check the preview. Since the preview is a browser, it should now show the `DesktopHome` immediately (after hydration) without flashing `HomeHub`.
   - Ensure `isDesktop` (which already starts as `false`) doesn't cause a mobile-to-desktop flash on PC.

I will also check if `src/routes/__root.tsx` has any similar logic that needs synchronization.
