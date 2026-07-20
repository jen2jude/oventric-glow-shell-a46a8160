import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  dismissProfileSetupDialog,
} from "./helpers/visual";

test.describe("MobileNav visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    if (vp.width >= 768) continue; // footer nav is `md:hidden`
    test(`mobile-nav @ ${vp.label}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await restoreSession(page, context);
      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      const nav = page.getByTestId("mobile-nav");
      await expect(nav).toBeVisible();
      await expect(nav).toHaveScreenshot(`mobile-nav-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
      });

      // Floating + button — the static RGB border is the exact element
      // that broke on Note 11i during earlier iterations.
      const createBtn = nav.getByRole("button", { name: /create/i });
      await expect(createBtn).toBeVisible();
      await expect(createBtn).toHaveScreenshot(
        `mobile-nav-create-${vp.label}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });
  }
});
