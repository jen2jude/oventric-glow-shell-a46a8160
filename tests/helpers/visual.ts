import { expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * Shared helpers for mobile visual-regression specs. Every high-risk
 * surface (Feed, Marketplace, Academy, Bounties, Wallet, Dashboard,
 * MegaMenu, MobileNav, Profile) uses these to loop mobile viewports
 * under an Android UA, restore the managed Supabase session, and
 * neutralize animations so `toHaveScreenshot` diffs stay deterministic.
 */

export type Viewport = { label: string; width: number; height: number };

export const MOBILE_VIEWPORTS: readonly Viewport[] = [
  { label: "narrow-320", width: 320, height: 720 },
  { label: "iphone-se-375", width: 375, height: 812 },
  { label: "iphone-13-390", width: 390, height: 844 },
  { label: "pixel-7-412", width: 412, height: 915 },
  { label: "galaxy-a-360", width: 360, height: 800 },
  { label: "tablet-768", width: 768, height: 1024 },
] as const;

// Android Chrome UA — several detection paths (including `html.low-gpu`)
// key off UA sniffing. Running under a real mobile UA keeps the suite honest.
export const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

export async function restoreSession(
  page: Page,
  context: BrowserContext,
): Promise<string | null> {
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!sessionJson || !storageKey) return null;

  if (cookiesJson) {
    const cookies = JSON.parse(cookiesJson).map(
      (c: Record<string, unknown>) => ({ ...c, url: "http://localhost:8080" }),
    );
    await context.addCookies(cookies);
  }
  await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [storageKey, sessionJson],
  );

  const parsed = JSON.parse(sessionJson);
  return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
}

/**
 * Force the low-GPU code path on. Must be called after any localhost
 * navigation but before the page that renders the surface being tested.
 */
export async function forceLowGpu(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("oventric:gpu-mode", "low");
      document.documentElement.classList.add("low-gpu");
    } catch {
      /* ignore */
    }
  });
}

export async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  });
  await page.evaluate(() => document.fonts?.ready);
  await page
    .getByRole("status", { name: /successfully signed in/i })
    .waitFor({ state: "hidden", timeout: 2500 })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

export async function dismissProfileSetupDialog(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: /finish setting up your account/i,
  });
  const isOpen = await dialog
    .waitFor({ state: "visible", timeout: 1200 })
    .then(() => true)
    .catch(() => false);
  if (!isOpen) return;
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await page.evaluate(() => {
    document.body.style.overflow = "";
  });
}

/**
 * Navigate the mobile home-screen section switcher by dispatching the
 * same custom event the footer nav emits. Requires the page to be on
 * "/" already.
 */
export async function switchSection(page: Page, section: string) {
  await page.evaluate((s) => {
    window.dispatchEvent(
      new CustomEvent("oventric:navigate", { detail: { section: s } }),
    );
  }, section);
  await page.waitForTimeout(200);
}
