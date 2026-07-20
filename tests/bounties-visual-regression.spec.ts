import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  switchSection,
  dismissProfileSetupDialog,
} from "./helpers/visual";

test.describe("Bounties visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`bounties snapshots @ ${vp.label}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await restoreSession(page, context);
      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      await switchSection(page, "Bounties");
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      // Summary strip (active pool + active count) is the first grid.
      const summary = page.locator("main .grid").first();
      await expect(summary).toBeVisible();
      await summary.scrollIntoViewIfNeeded();
      await expect(summary).toHaveScreenshot(
        `bounties-summary-${vp.label}.png`,
        { maxDiffPixelRatio: 0.03 },
      );
    });
  }
});
