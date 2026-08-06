/**
 * Deep-link handling for the native shell.
 *
 * Handles both link styles:
 *   - Universal / App Links:  https://oventric.com/product/123
 *   - Custom scheme:          oventric://product/123
 *
 * Anything that isn't ours (external http links) is opened in the system
 * browser instead of hijacking the app's webview.
 */
import { isNativeApp } from "@/lib/native/capacitor";

const APP_HOSTS = new Set(["oventric.com", "www.oventric.com", "oventric-glow-shell.lovable.app"]);
const APP_SCHEME = "oventric";

/** Turn any incoming link into an in-app path, or null when it isn't ours. */
export function toInternalPath(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol === `${APP_SCHEME}:`) {
    // oventric://product/123?x=1  →  /product/123?x=1
    const path = `${url.hostname ? `/${url.hostname}` : ""}${url.pathname || ""}` || "/";
    return `${path.replace(/\/{2,}/g, "/")}${url.search}${url.hash}`;
  }

  if ((url.protocol === "https:" || url.protocol === "http:") && APP_HOSTS.has(url.hostname)) {
    if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return null;
}

/**
 * Listen for links that launched or resumed the app and route to them.
 * No-ops on the web (where the browser already resolves the URL itself).
 */
export async function initDeepLinks(navigate: (path: string) => void) {
  if (!isNativeApp()) return () => {};

  try {
    const { App } = await import("@capacitor/app");

    // Cold start: the app may already have been opened with a URL.
    const launch = await App.getLaunchUrl();
    const launchPath = launch?.url ? toInternalPath(launch.url) : null;
    if (launchPath) navigate(launchPath);

    const handle = await App.addListener("appUrlOpen", ({ url }) => {
      const path = toInternalPath(url);
      if (path) {
        navigate(path);
        return;
      }
      // External link — hand it to the system browser.
      void import("@capacitor/browser")
        .then(({ Browser }) => Browser.open({ url }))
        .catch(() => {});
    });

    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
