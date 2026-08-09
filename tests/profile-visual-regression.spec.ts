import { test, expect } from "@playwright/test";
import {
  ANDROID_UA,
  MOBILE_VIEWPORTS as VIEWPORTS,
  restoreSession,
  stabilize,
  dismissProfileSetupDialog,
} from "./helpers/visual";

/**
 * Visual regression suite for the profile screen. Captures pixel-diffed
 * screenshots of the header, cover/banner, and avatar across the mobile
 * breakpoints where Android Chrome previously showed scrambled/scanline
 * rendering. First run creates baselines; subsequent runs diff against
 * them via Playwright's `toHaveScreenshot`.
 */

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
      await dismissProfileSetupDialog(page);
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

      // 4) (Reputation block removed from the identity hub redesign.)


      // 5) Tabs nav — horizontal scroller that historically triggered
      // overflow/compositor bugs on narrow Android widths.
      const tabs = page.getByTestId("profile-tabs");
      await expect(tabs).toBeVisible();
      await tabs.scrollIntoViewIfNeeded();
      await expect(tabs).toHaveScreenshot(`tabs-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });

      // 6) Tab content region below the tabs — where scrambling
      // extended past the reputation card on affected devices.
      const tabContent = page.getByTestId("profile-tab-content");
      await expect(tabContent).toBeVisible();
      await tabContent.scrollIntoViewIfNeeded();
      await expect(tabContent).toHaveScreenshot(`tab-content-${vp.label}.png`, {
        maxDiffPixelRatio: 0.03,
        animations: "disabled",
      });
    });
  }
});

