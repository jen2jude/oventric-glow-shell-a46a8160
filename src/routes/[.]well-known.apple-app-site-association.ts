import { createFileRoute } from "@tanstack/react-router";

/**
 * Apple App Site Association — lets iOS open https://oventric.com/... links
 * directly in the native app (Universal Links).
 *
 * The Apple Team ID is read from the APPLE_TEAM_ID secret so the file can be
 * published before the app is signed; until it is set the file advertises no
 * app and iOS simply keeps opening links in Safari.
 */
export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: async () => {
        const teamId = process.env["APPLE_TEAM_ID"];
        const bundleId = process.env["IOS_BUNDLE_ID"] ?? "com.oventric.app";
        const appIDs = teamId ? [`${teamId}.${bundleId}`] : [];

        const body = {
          applinks: {
            details: [
              {
                appIDs,
                components: [
                  // Never hand OAuth, API or asset paths to the app.
                  { "/": "/~oauth/*", exclude: true },
                  { "/": "/api/*", exclude: true },
                  { "/": "/.well-known/*", exclude: true },
                  { "/": "/*", comment: "Open every other Oventric page in the app" },
                ],
              },
            ],
          },
          webcredentials: { apps: appIDs },
        };

        return new Response(JSON.stringify(body), {
          headers: {
            // Must be application/json and must NOT be cached aggressively.
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
