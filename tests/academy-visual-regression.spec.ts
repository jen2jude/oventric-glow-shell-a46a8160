import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  switchSection,
  dismissProfileSetupDialog,
} from "./helpers/visual";

test.describe("Academy visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`academy snapshots @ ${vp.label}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await restoreSession(page, context);
      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      await switchSection(page, "Academy");
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      const shell = page.locator("main .max-w-5xl").first();
      await expect(shell).toBeVisible();
      await expect(shell).toHaveScreenshot(`academy-shell-${vp.label}.png`, {
        maxDiffPixelRatio: 0.03,
      });
    });
  }
});
