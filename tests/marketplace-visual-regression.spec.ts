import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  switchSection,
  dismissProfileSetupDialog,
} from "./helpers/visual";

test.describe("Marketplace visual regression @ mobile breakpoints", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`marketplace snapshots @ ${vp.label}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const userId = await restoreSession(page, context);
      // Marketplace is public but the session avoids the auth-gate flash.
      if (!userId) {
        await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      }
      await switchSection(page, "Marketplace");
      await dismissProfileSetupDialog(page);
      await stabilize(page);

      // Mode switcher (Digital / Physical pills). Uses .rgb-static-border on active.
      const modeSwitch = page
        .getByRole("button", { name: /digital/i })
        .locator("xpath=ancestor::*[contains(@class,'rounded-full')][1]")
        .first();
      await expect(modeSwitch).toBeVisible();
      await modeSwitch.scrollIntoViewIfNeeded();
      await expect(modeSwitch).toHaveScreenshot(
        `market-mode-switch-${vp.label}.png`,
      );

      // First product tile in the grid — the promoted or standard card is
      // the most common site of the compositor tearing artifact.
      const grid = page
        .locator("main .grid")
        .filter({ has: page.locator("a, article, button") })
        .first();
      await expect(grid).toBeVisible();
      const firstCard = grid.locator(":scope > *").first();
      const cardCount = await grid.locator(":scope > *").count();
      test.skip(cardCount === 0, "Marketplace grid is empty in this env");
      await firstCard.scrollIntoViewIfNeeded();
      await expect(firstCard).toHaveScreenshot(
        `market-first-card-${vp.label}.png`,
        { maxDiffPixelRatio: 0.03 },
      );
    });
  }
});
