import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell configuration for the iOS / Android builds.
 *
 * Oventric is a server-rendered app, so the native shell loads the live
 * published site instead of a static bundle. `webDir` still points at the
 * client build so `npx cap sync` has something to copy (offline fallback).
 *
 * To build against a local dev server instead, run with
 * `CAP_SERVER_URL=http://192.168.x.x:8080 npx cap run ios`.
 */
const serverUrl = process.env["CAP_SERVER_URL"] ?? "https://www.oventric.com";

const config: CapacitorConfig = {
  appId: "com.oventric.app",
  appName: "Oventric",
  webDir: "dist/client",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#121214",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: "#121214",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: "#121214",
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#121214",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
