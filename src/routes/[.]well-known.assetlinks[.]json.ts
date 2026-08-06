import { createFileRoute } from "@tanstack/react-router";

/**
 * Android Digital Asset Links — lets Android open https://oventric.com/...
 * links straight in the native app (App Links).
 *
 * Add the release keystore's SHA-256 fingerprint(s) as the
 * ANDROID_CERT_FINGERPRINTS secret (comma-separated) once the app is signed.
 */
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const packageName = process.env["ANDROID_PACKAGE_NAME"] ?? "com.oventric.app";
        const fingerprints = (process.env["ANDROID_CERT_FINGERPRINTS"] ?? "")
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);

        const body = fingerprints.length
          ? [
              {
                relation: ["delegate_permission/common.handle_all_urls"],
                target: {
                  namespace: "android_app",
                  package_name: packageName,
                  sha256_cert_fingerprints: fingerprints,
                },
              },
            ]
          : [];

        return new Response(JSON.stringify(body), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
