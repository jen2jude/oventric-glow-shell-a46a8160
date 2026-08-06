/**
 * Tiny haptics helper. Uses the native Capacitor engine inside the iOS /
 * Android shell, the Vibration API in browsers that support it, and silently
 * no-ops elsewhere (iOS Safari) so callers never need feature checks.
 */
import { nativeHaptic } from "@/lib/native/capacitor";


type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "select";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 24,
  select: 6,
  success: [10, 40, 16],
  warning: [16, 60, 16],
  error: [24, 50, 24, 50, 24],
};

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function haptic(kind: HapticKind = "light") {
  if (!enabled) return;
  // Native shell: use the real iOS / Android haptic engine.
  void nativeHaptic(kind).then((handled) => {
    if (handled) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(PATTERNS[kind]);
    } catch {
      /* ignore */
    }
  });
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ignore */
  }
}
