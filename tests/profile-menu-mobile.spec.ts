import { test, expect } from "@playwright/test";

/**
 * Verifies the mobile profile dropdown renders as a bottom sheet that visually
 * sits above the feed and the sticky global header. Run against a running dev
 * server at http://localhost:8080 with an authenticated preview session.
 */
test.describe("Profile menu mobile stacking", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("bottom sheet overlays feed and header", async ({ page, context }) => {
    // Restore Lovable-managed Supabase session so the authenticated header
    // (and its profile trigger) renders.
    const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
    const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
    const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
    if (cookiesJson) {
      const cookies = JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({
        ...c,
        url: "http://localhost:8080",
      }));
      await context.addCookies(cookies);
    }
    await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
    if (storageKey && sessionJson) {
      await page.evaluate(
        ([k, v]) => window.localStorage.setItem(k, v),
        [storageKey, sessionJson],
      );
    }
    await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });

    const trigger = page.getByLabel("Open profile menu");
    await expect(trigger).toBeVisible();
    await trigger.click();

    const menu = page.locator("#profile-dropdown-menu");
    await expect(menu).toBeVisible();

    // Portaled to <body> so it escapes any transformed/backdrop-filtered ancestor.
    const parentTag = await menu.evaluate((el) => el.parentElement?.tagName);
    expect(parentTag).toBe("BODY");

    // Anchored to the bottom of the viewport (bottom sheet, not clipped up top).
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeGreaterThan(700);
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(390);

    // Stacks above the sticky header and feed content.
    const menuZ = await menu.evaluate((el) =>
      parseInt(getComputedStyle(el).zIndex || "0", 10),
    );
    const headerZ = await page
      .locator("header")
      .first()
      .evaluate((el) => parseInt(getComputedStyle(el).zIndex || "0", 10));
    expect(menuZ).toBeGreaterThan(headerZ);

    // A point inside the sheet must hit-test to the sheet (or its descendants),
    // not the underlying feed.
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest("#profile-dropdown-menu") !== null;
    }, { x: box!.x + box!.width / 2, y: box!.y + 40 });
    expect(hit).toBe(true);

    // Backdrop dismisses the sheet.
    await page.mouse.click(box!.x + box!.width / 2, 20);
    await expect(menu).toHaveCount(0);
  });
});
