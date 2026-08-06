/**
 * Single registrar for the generated app-shell service worker (`/sw.js`).
 *
 * Never registers in dev, inside an iframe, in Lovable preview hosts, or when
 * the URL carries `?sw=off` — in any of those cases a matching registration is
 * removed instead. The Firebase-style push worker (`/push-sw.js`) uses a
 * different scope/file and is intentionally left untouched.
 */
const SW_URL = "/sw.js";

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    return new URLSearchParams(window.location.search).get("sw") === "off";
  }
  return false;
}

async function unregisterAppShell() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL || r.waiting?.scriptURL || "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

type UpdateListener = (ready: boolean) => void;

const listeners = new Set<UpdateListener>();
let waitingWorker: ServiceWorker | null = null;
let reloading = false;
let registrationRef: ServiceWorkerRegistration | null = null;

function announce(worker: ServiceWorker | null) {
  waitingWorker = worker;
  listeners.forEach((fn) => fn(Boolean(worker)));
}

/** Subscribe to "a new app version is installed and waiting" changes. */
export function onServiceWorkerUpdate(fn: UpdateListener): () => void {
  listeners.add(fn);
  fn(Boolean(waitingWorker));
  return () => listeners.delete(fn);
}

/** Activate the waiting worker and reload once it takes control. */
export function applyServiceWorkerUpdate() {
  if (reloading) return;
  if (!waitingWorker) {
    reloading = true;
    window.location.reload();
    return;
  }
  reloading = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  });
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  // Safety net if controllerchange never fires.
  window.setTimeout(() => window.location.reload(), 3000);
}

/** Manually check for a newer build right now. */
export async function checkForUpdateNow(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!registrationRef) return false;
  try {
    await registrationRef.update();
    return Boolean(waitingWorker);
  } catch {
    return false;
  }
}

function track(reg: ServiceWorkerRegistration) {
  if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);

  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        announce(installing);
      }
    });
  });

  const check = () => {
    if (document.visibilityState === "visible") reg.update().catch(() => {});
  };
  window.setInterval(check, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
}

export function registerAppServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isBlockedContext()) {
    void unregisterAppShell();
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then((reg) => track(reg))
      .catch(() => {});
  });
}

