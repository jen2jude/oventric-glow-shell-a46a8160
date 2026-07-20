import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS,
  restoreSession,
  stabilize,
  forceLowGpu,
  dismissProfileSetupDialog,
} from "./helpers/visual";

/**
 * MegaMenu is rendered twice in production: a premium variant on capable
 * devices, and a safe variant on `html.low-gpu`. This spec locks both.
 */

async function openMegaMenu(page: import("@playwright/test").Page) {
  const opener = page
    .getByRole("button", { name: /menu|open menu|hamburger/i })
    .or(page.locator('[aria-label*="menu" i]'))
    .first();
  await opener.click({ trial: false });
  await page.getByRole("dialog", { name: /menu/i }).waitFor({ state: "visible" });
}

for (const variant of ["premium", "low-gpu"] as const) {
  test.describe(`MegaMenu (${variant}) visual regression @ mobile`, () => {
    test.use({ userAgent: ANDROID_UA });

    for (const vp of MOBILE_VIEWPORTS) {
      test(`megamenu-${variant} @ ${vp.label}`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        if (variant === "low-gpu") await forceLowGpu(page);
        await restoreSession(page, context);
        await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
        await dismissProfileSetupDialog(page);
        await stabilize(page);

        await openMegaMenu(page);
        await page.waitForTimeout(150);

        const menu = page.getByRole("dialog", { name: /menu/i }).first();
        await expect(menu).toBeVisible();
        await expect(menu).toHaveScreenshot(
          `megamenu-${variant}-${vp.label}.png`,
          { maxDiffPixelRatio: 0.03 },
        );
      });
    }
  });
}
