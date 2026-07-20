import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  switchSection,
  dismissProfileSetupDialog,
} from "./helpers/visual";

test.describe("Wallet visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`wallet snapshots @ ${vp.label}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const userId = await restoreSession(page, context);
      test.skip(!userId, "Wallet requires an authenticated session");

      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      await switchSection(page, "Wallet");
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      // Balance card — first card in the wallet section.
      const balance = page.locator("main section").first();
      await expect(balance).toBeVisible();
      await balance.scrollIntoViewIfNeeded();
      await expect(balance).toHaveScreenshot(
        `wallet-balance-${vp.label}.png`,
        { maxDiffPixelRatio: 0.03 },
      );
    });
  }
});
