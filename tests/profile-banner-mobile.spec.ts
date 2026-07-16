import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Regression test for the profile banner rendering across mobile / tablet
 * viewport widths. Guards against the GPU-corruption bug where the banner
 * used to render scanline tearing, SVG turbulence noise, or a collapsed
 * gradient stripe on mobile Chromium builds.
 *
 * We assert, at every checked viewport, that the banner:
 *   1. Is visible and has a non-zero box that spans the visible width.
 *   2. Avoids hardware-accel/compositor hints on mobile. Real Android Chrome
 *      devices showed static-noise corruption when profile surfaces used
 *      transform/backface/contain/will-change promotion during pull refresh.
 *   3. Contains no SVG <feTurbulence> filter / `filter: url(...)` /
 *      `backdrop-filter: blur(...)` — the effects that produced the
 *      corrupted static-noise banner.
 *   4. Has a computed background that is either a solid color or a
 *      linear-gradient (never an image / SVG data URI).
 *   5. Contains a plain avatar wrapper with no compositor promotion.
 */

const VIEWPORTS = [
  { label: "iphone-se", width: 320, height: 720 },
  { label: "iphone-13", width: 390, height: 800 },
  { label: "pixel-7", width: 412, height: 900 },
  { label: "ipad-mini", width: 768, height: 1024 },
];

async function restoreSession(page: Page, context: BrowserContext): Promise<string | null> {
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!sessionJson || !storageKey) return null;

  if (cookiesJson) {
    const cookies = JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({
      ...c,
      url: "http://localhost:8080",
    }));
    await context.addCookies(cookies);
  }
  await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [storageKey, sessionJson],
  );

  const parsed = JSON.parse(sessionJson);
  return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
}

async function dismissProfileSetupDialog(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: /finish setting up your account/i,
  });
  const isOpen = await dialog
    .waitFor({ state: "visible", timeout: 1200 })
    .then(() => true)
    .catch(() => false);

  if (!isOpen) return;

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await page.evaluate(() => {
    document.body.style.overflow = "";
  });
}

test.describe("Profile banner renders without visual corruption", () => {
  for (const vp of VIEWPORTS) {
    test(`renders cleanly @ ${vp.label} (${vp.width}x${vp.height})`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const userId = await restoreSession(page, context);
      test.skip(!userId, "No authenticated Lovable Supabase session available");

      await page.goto(`http://localhost:8080/profile/${userId}`, {
        waitUntil: "networkidle",
      });
      await dismissProfileSetupDialog(page);
      await page
        .getByRole("status", { name: /successfully signed in/i })
        .waitFor({ state: "hidden", timeout: 2500 })
        .catch(() => undefined);

      const banner = page.getByTestId("profile-banner");
      await expect(banner).toBeVisible();

      const box = await banner.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(vp.width * 0.6);
      expect(box!.height).toBeGreaterThan(80);

      // No SVG turbulence / noise filter nodes anywhere in the banner subtree.
      const feTurbulenceCount = await banner.locator("feTurbulence, feDisplacementMap").count();
      expect(feTurbulenceCount).toBe(0);

      // No CSS filter / backdrop-filter / compositor promotion that could
      // trigger the Android Chromium corruption path.
      const styles = await banner.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          filter: cs.filter,
          backdropFilter: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "",
          backgroundImage: cs.backgroundImage,
          backgroundColor: cs.backgroundColor,
          transform: cs.transform,
          backfaceVisibility: cs.backfaceVisibility,
          contain: cs.contain,
          willChange: cs.willChange,
        };
      });

      expect(styles.filter === "none" || styles.filter === "").toBeTruthy();
      expect(
        styles.backdropFilter === "none" || styles.backdropFilter === "",
      ).toBeTruthy();

      // Background must be a solid color or plain gradient — never an image
      // / SVG data URI that could re-introduce the noise texture.
      expect(styles.backgroundImage).not.toMatch(/url\(/i);
      const isGradientOrNone =
        styles.backgroundImage === "none" ||
        /linear-gradient|radial-gradient/i.test(styles.backgroundImage);
      expect(isGradientOrNone).toBe(true);

      expect(styles.transform).toBe("none");
      expect(styles.backfaceVisibility === "visible" || styles.backfaceVisibility === "auto").toBeTruthy();
      expect(styles.contain === "none" || styles.contain === "").toBeTruthy();
      expect(styles.willChange === "auto" || styles.willChange === "").toBeTruthy();

      // Avatar wrapper is the first child region that must also be
      // GPU-safe. Locate by role heading (name) and walk to its avatar
      // sibling via the banner grid.
      const avatarSafety = await banner.evaluate((el) => {
        const avatar = el.querySelector<HTMLElement>(".rounded-full");
        if (!avatar) return null;
        const cs = getComputedStyle(avatar);
        return {
          filter: cs.filter,
          backdrop: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "",
          transform: cs.transform,
          backface: cs.backfaceVisibility,
          contain: cs.contain,
          willChange: cs.willChange,
        };
      });
      expect(avatarSafety).not.toBeNull();
      expect(avatarSafety!.filter === "none" || avatarSafety!.filter === "").toBeTruthy();
      expect(avatarSafety!.backdrop === "none" || avatarSafety!.backdrop === "").toBeTruthy();
      expect(avatarSafety!.transform).toBe("none");
      expect(avatarSafety!.backface === "visible" || avatarSafety!.backface === "auto").toBeTruthy();
      expect(avatarSafety!.contain === "none" || avatarSafety!.contain === "").toBeTruthy();
      expect(avatarSafety!.willChange === "auto" || avatarSafety!.willChange === "").toBeTruthy();

      // Visual sanity check — save a screenshot per viewport for manual
      // inspection when a regression is suspected.
      await banner.screenshot({
        path: `test-results/profile-banner-${vp.label}.png`,
      });
    });
  }
});
