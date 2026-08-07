import { useEffect, useState } from "react";

import { isNativeApp } from "@/lib/native/capacitor";

export type LaunchContext = "native" | "standalone" | "browser";

/**
 * How the app was launched:
 * - "native"      → Capacitor shell (APK / iOS build)
 * - "standalone"  → installed PWA / added to home screen
 * - "browser"     → normal browser tab (desktop or mobile)
 *
 * Returns `null` until after hydration so SSR markup stays stable.
 */
export function useLaunchContext(): LaunchContext | null {
  const [ctx, setCtx] = useState<LaunchContext | null>(null);

  useEffect(() => {
    const read = (): LaunchContext => {
      // Manual override for testing
      const params = new URLSearchParams(window.location.search);
      const forceMode = params.get("mode");
      if (forceMode === "app") return "native";
      if (forceMode === "web") return "browser";

      if (isNativeApp()) return "native";
      const standalone =
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(display-mode: standalone)").matches) ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      return standalone ? "standalone" : "browser";
    };
    setCtx(read());

    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setCtx(read());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return ctx;
}

/** True for the app-like shells (native build or installed PWA). */
export function useIsAppShell(): boolean {
  const ctx = useLaunchContext();
  // Default to false during hydration so browser visitors see marketing first.
  return ctx === "native" || ctx === "standalone";
}
