/**
 * Browser-side Web Push helpers.
 *
 * The service worker registered here is a *messaging* worker only — it never
 * caches HTML or assets, so it can't serve stale pages. It is still kept out
 * of the Lovable editor preview (iframes / preview hosts) where service
 * workers are unwanted.
 */

import { getPushPublicKey, savePushSubscription, removePushSubscription } from "@/lib/push.functions";

const SW_URL = "/push-sw.js";
export const PUSH_DISMISS_KEY = "oventric:push-prompt-dismissed";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Preview / iframe contexts must not register service workers. */
export function pushAllowedHere(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return false;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return false;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return false;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return false;
  return true;
}

/** iOS only allows push once the site is installed to the Home Screen. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari in a normal tab can never subscribe — surface an install hint. */
export function needsHomeScreenInstall(): boolean {
  return isIos() && !isStandalone();
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function encodeKey(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || !pushAllowedHere()) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    return null;
  }
}

/** Ask permission (if needed), subscribe this device and store it server-side. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!pushAllowedHere()) return { ok: false, reason: "preview" };
  if (needsHomeScreenInstall()) return { ok: false, reason: "install-required" };

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission };

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: "no-worker" };
  await navigator.serviceWorker.ready;

  const { key } = await getPushPublicKey();
  if (!key) return { ok: false, reason: "misconfigured" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? encodeKey(sub.getKey("p256dh")),
      auth: json.keys?.auth ?? encodeKey(sub.getKey("auth")),
      userAgent: navigator.userAgent,
    },
  });

  return { ok: true };
}

/** Unsubscribe this device and forget it server-side. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
    try {
      await removePushSubscription({ data: { endpoint } });
    } catch {
      /* ignore */
    }
  }
}

/** True when this device already has an active push subscription. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || !pushAllowedHere()) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/**
 * Silently re-sync an existing subscription with the backend (e.g. after the
 * user signs in on a device that already granted permission).
 */
export async function syncExistingPush(): Promise<void> {
  if (!pushSupported() || !pushAllowedHere()) return;
  if (Notification.permission !== "granted") return;
  try {
    await enablePush();
  } catch {
    /* ignore */
  }
}
