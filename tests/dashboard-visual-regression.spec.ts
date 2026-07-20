import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  dismissProfileSetupDialog,
} from "./helpers/visual";

test.describe("Dashboard visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`dashboard snapshots @ ${vp.label}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const userId = await restoreSession(page, context);
      test.skip(!userId, "Dashboard requires an authenticated session");

      await page.goto("http://localhost:8080/dashboard", {
        waitUntil: "networkidle",
      });
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      // Overview stat rows — the mobile single-line StatCard is the exact
      // region that showed scrambled pixels on affected devices.
      const overview = page.locator("main, .min-h-screen").first();
      await expect(overview).toBeVisible();
      const firstCard = page
        .locator(".rounded-xl.border")
        .filter({ hasNot: page.locator("button:has-text('Back')") })
        .first();
      await expect(firstCard).toBeVisible();
      await firstCard.scrollIntoViewIfNeeded();
      await expect(firstCard).toHaveScreenshot(
        `dashboard-overview-${vp.label}.png`,
        { maxDiffPixelRatio: 0.03 },
      );
    });
  }
});
