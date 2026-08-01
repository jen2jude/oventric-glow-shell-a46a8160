import { test, expect } from "@playwright/test";
import { ANDROID_UA, MOBILE_VIEWPORTS, stabilize } from "./helpers/visual";

const CAROUSEL = '[role="dialog"][aria-label="Welcome to Oventric"]';
const STORAGE_KEY = "oventric:seen-feature-carousel";

test.describe("First-launch feature carousel", () => {
  test.use({ userAgent: ANDROID_UA });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`shows on first visit and can be completed @ ${vp.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Simulate a brand-new device/session.
      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
      await page.reload({ waitUntil: "networkidle" });
      await stabilize(page);

      const carousel = page.locator(CAROUSEL);
      await expect(carousel).toBeVisible({ timeout: 15000 });

      // First slide should be Feed.
      await expect(page.locator("h2").filter({ hasText: "Feed" }).first()).toBeVisible();

      // Navigate through all 5 slides.
      for (let i = 0; i < 4; i++) {
        await page.get_by_role("button", { name: "Next slide" }).click();
        await page.waitForTimeout(300);
      }

      await page.get_by_role("button", { name: "Get started" }).click();
      await page.waitForTimeout(500);

      // Carousel should be dismissed.
      await expect(carousel).not.toBeVisible();

      // localStorage flag should be set.
      const seen = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      expect(seen).toBe("true");

      // Reloading should not show the carousel again.
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await expect(carousel).not.toBeVisible();
    });

    test(`can be skipped and does not reappear @ ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
      await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
      await page.reload({ waitUntil: "networkidle" });
      await stabilize(page);

      const carousel = page.locator(CAROUSEL);
      await expect(carousel).toBeVisible({ timeout: 15000 });

      await page.get_by_role("button", { name: "Skip introduction" }).click();
      await page.waitForTimeout(500);

      await expect(carousel).not.toBeVisible();
      const seen = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      expect(seen).toBe("true");
    });
  }
});
