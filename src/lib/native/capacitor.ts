/**
 * Capacitor native-shell helpers.
 *
 * Everything here is safe to import from web code: plugins are loaded
 * dynamically and every call no-ops when the app runs in a normal browser.
 */

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

/** Fire a native haptic; returns false when not running natively. */
export async function nativeHaptic(
  kind: "light" | "medium" | "heavy" | "select" | "success" | "warning" | "error",
): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "select") {
      await Haptics.selectionStart();
      await Haptics.selectionEnd();
      return true;
    }
    if (kind === "success" || kind === "warning" || kind === "error") {
      const type =
        kind === "success"
          ? NotificationType.Success
          : kind === "warning"
            ? NotificationType.Warning
            : NotificationType.Error;
      await Haptics.notification({ type });
      return true;
    }
    const style =
      kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
    await Haptics.impact({ style });
    return true;
  } catch {
    return false;
  }
}

/** Share via the native sheet; falls back to the Web Share API. */
export async function nativeShare(options: { title?: string; text?: string; url?: string }) {
  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share(options);
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(options);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

let initialised = false;

/**
 * Wire status bar, splash screen, keyboard and Android hardware back button.
 * Called once from the root component; no-op on the web.
 */
export async function initNativeShell(onBack?: () => boolean) {
  if (initialised || !isNativeApp()) return;
  initialised = true;

  document.documentElement.classList.add("native-app", `native-${nativePlatform()}`);

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#121214" });
    }
  } catch {
    /* plugin unavailable */
  }

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    if (nativePlatform() === "ios") await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch {
    /* plugin unavailable */
  }

  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", ({ canGoBack }) => {
      const handled = onBack?.();
      if (handled) return;
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
  } catch {
    /* plugin unavailable */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    window.setTimeout(() => void SplashScreen.hide({ fadeOutDuration: 300 }), 600);
  } catch {
    /* plugin unavailable */
  }
}
