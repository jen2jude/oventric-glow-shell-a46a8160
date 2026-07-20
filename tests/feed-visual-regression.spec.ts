import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  dismissProfileSetupDialog,
  restoreSession,
  stabilize,
} from "./helpers/visual";

test.describe("Feed visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`feed snapshots @ ${vp.label} (${vp.width}x${vp.height})`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const userId = await restoreSession(page, context);
      test.skip(!userId, "No authenticated Lovable Supabase session available");

      await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      // 1) App header — sticky top bar.
      const header = page.locator("header").first();
      await expect(header).toBeVisible();
      await expect(header).toHaveScreenshot(`feed-header-${vp.label}.png`);

      // 2) Composer trigger row — avatar snippet + placeholder + hint.
      // Historically scrambled on the composer's rgb-static-border avatar wrap.
      const composer = page.locator("#oventric-composer");
      await expect(composer).toBeVisible();
      await composer.scrollIntoViewIfNeeded();
      await expect(composer).toHaveScreenshot(`feed-composer-${vp.label}.png`);
    });
  }
});
