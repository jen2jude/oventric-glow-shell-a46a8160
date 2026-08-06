// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        // Registration happens only through src/lib/pwa/register-sw.ts.
        injectRegister: null,
        injectManifest: undefined,
        filename: "sw.js",
        // The browser-facing bundle lands in dist/client — the worker and its
        // precache manifest must be generated from (and into) that folder.
        outDir: "dist/client",
        // public/manifest.webmanifest is authored by hand.
        manifest: false,

        devOptions: { enabled: false },
        workbox: {
          globPatterns: ["**/*.{js,css,woff2,svg}"],
          globIgnores: ["**/push-sw.js", "**/sw.js"],
          navigateFallback: undefined,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // Take over immediately so a plain refresh always lands on the newest
          // deployed build. The in-app update prompt still works as a nudge.
          skipWaiting: true,

          runtimeCaching: [
            {
              // HTML navigations always come from the network (SSR pages).
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && ["style", "script", "worker", "font"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "oventric-assets" },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "oventric-images",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
