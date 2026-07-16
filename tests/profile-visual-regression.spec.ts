import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Visual regression suite for the profile screen. Captures pixel-diffed
 * screenshots of the header, cover/banner, and avatar across the mobile
 * breakpoints where Android Chrome previously showed scrambled/scanline
 * rendering. First run creates baselines; subsequent runs diff against
 * them via Playwright's `toHaveScreenshot` (default threshold, small
 * `maxDiffPixelRatio` to tolerate font/AA jitter).
 *
 * If a future change re-introduces SVG turbulence, backdrop-blur, animated
 * gradients, or GPU-compositor promotion on the profile surface, the pixel
 * diff will trip even if the CSS assertions in
 * `profile-banner-mobile.spec.ts` are updated to allow the new property.
 */

const VIEWPORTS = [
  { label: "narrow-320", width: 320, height: 720 },
  { label: "iphone-se-375", width: 375, height: 812 },
  { label: "iphone-13-390", width: 390, height: 844 },
  { label: "pixel-7-412", width: 412, height: 915 },
  { label: "galaxy-a-360", width: 360, height: 800 },
  { label: "tablet-768", width: 768, height: 1024 },
];

// Android Chrome UA — some code paths key off UA sniffing; keep the diff
// suite honest by running under a realistic mobile UA.
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

async function restoreSession(
  page: Page,
  context: BrowserContext,
): Promise<string | null> {
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!sessionJson || !storageKey) return null;

  if (cookiesJson) {
    const cookies = JSON.parse(cookiesJson).map(
      (c: Record<string, unknown>) => ({ ...c, url: "http://localhost:8080" }),
    );
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

async function stabilize(page: Page) {
  // Neutralize animations, caret blinks, and lazy image fades so pixel
  // diffs are deterministic across runs.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForLoadState("networkidle");
}

test.describe("Profile visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of VIEWPORTS) {
    test(`profile snapshots @ ${vp.label} (${vp.width}x${vp.height})`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const userId = await restoreSession(page, context);
      test.skip(
        !userId,
        "No authenticated Lovable Supabase session available",
      );

      await page.goto(`http://localhost:8080/profile/${userId}`, {
        waitUntil: "networkidle",
      });
      await stabilize(page);

      // 1) Sticky app header (top bar) — first ~72px of viewport.
      const header = page.locator("header").first();
      await expect(header).toBeVisible();
      await expect(header).toHaveScreenshot(`header-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });

      // 2) Profile banner card (cover + name + counts region).
      const banner = page.getByTestId("profile-banner");
      await expect(banner).toBeVisible();
      await banner.scrollIntoViewIfNeeded();
      await expect(banner).toHaveScreenshot(`banner-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });

      // 3) Avatar wrapper — this is the element that most often shows
      // the scrambled-tile artifact when compositor promotion regresses.
      const avatar = banner.locator(".profile-avatar-safe").first();
      await expect(avatar).toBeVisible();
      await expect(avatar).toHaveScreenshot(`avatar-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
    });
  }
});
