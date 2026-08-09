import { useEffect, useSyncExternalStore } from "react";

/**
 * Tiny global store telling app chrome (feed header + bottom nav) to collapse
 * while the user scrolls down and re-appear when they scroll up.
 */
let hidden = false;
const listeners = new Set<() => void>();

function setHidden(next: boolean) {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Read-only: is app chrome currently collapsed? */
export function useChromeHidden() {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
}

/**
 * Drives the store from window scroll direction. Mount once (feed screen).
 * Small threshold avoids jitter; chrome always returns near the top.
 */
export function useScrollHideChrome(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    let last = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      if (y < 80) setHidden(false);
      else setHidden(delta > 0);
      last = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      setHidden(false);
    };
  }, [enabled]);
}
