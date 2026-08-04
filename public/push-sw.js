/* Oventric Web Push worker.
 * Messaging-only: it never caches HTML or app assets, so it cannot serve
 * stale pages. Its sole job is to render background notifications and to
 * focus/open the app when one is tapped.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Oventric", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Oventric";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    vibrate: [80, 40, 80],
    timestamp: Date.now(),
    data: { link: payload.link || "/", id: payload.id || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
