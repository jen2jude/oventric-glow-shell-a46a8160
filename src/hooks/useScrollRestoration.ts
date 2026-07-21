import { useCallback, useEffect, useRef } from "react";

/**
 * Reusable scroll restoration for in-page tab switches on mobile + desktop.
 *
 * On mobile the window is the scroll container; on desktop a scrollable
 * `<main>` (or similar) container often is. This hook reads/writes from
 * whichever is actually scrolling, and pins the position across a tab
 * change so React re-renders don't jump to the top.
 *
 * Usage:
 *   const { containerRef, getScrollY, setScrollY, pinAcrossChange, restore } =
 *     useScrollRestoration(tab);
 *   <main ref={containerRef}>...</main>
 *
 *   // when user clicks a tab:
 *   const y = getScrollY();
 *   pinAcrossChange(y);
 *   navigate(...);
 *
 *   // after new tab content is rendered:
 *   restore();
 */
export function useScrollRestoration<T>(key: T) {
  const containerRef = useRef<HTMLElement | null>(null);
  const pendingYRef = useRef<number | null>(null);
  const restoredRef = useRef<boolean>(true);

  const getScroller = useCallback((): HTMLElement | Window | null => {
    const el = containerRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1) return el;
    if (typeof window !== "undefined") return window;
    return null;
  }, []);

  const getScrollY = useCallback((): number => {
    const s = getScroller();
    if (!s) return 0;
    return s instanceof Window ? s.scrollY : s.scrollTop;
  }, [getScroller]);

  const setScrollY = useCallback(
    (y: number) => {
      const s = getScroller();
      if (!s) return;
      if (s instanceof Window) s.scrollTo(0, y);
      else s.scrollTop = y;
    },
    [getScroller],
  );

  // Pin scroll across an imminent view change. Applies immediately, on the
  // next frame, and on the next macrotask to survive layout thrash.
  const pinAcrossChange = useCallback(
    (y: number) => {
      pendingYRef.current = y;
      restoredRef.current = false;
      setScrollY(y);
      requestAnimationFrame(() => setScrollY(y));
      setTimeout(() => setScrollY(y), 0);
    },
    [setScrollY],
  );

  // Restore the pinned scroll position, falling back to `fallbackY` if none.
  const restore = useCallback(
    (fallbackY = 0) => {
      const target = pendingYRef.current ?? fallbackY;
      if (target > 0) setScrollY(target);
      pendingYRef.current = null;
      restoredRef.current = true;
    },
    [setScrollY],
  );

  // Reset pending pin when the tracked key changes AFTER restore fires
  useEffect(() => {
    return () => {
      // no-op; consumers call restore() when new content is ready
    };
  }, [key]);

  return {
    containerRef,
    getScrollY,
    setScrollY,
    pinAcrossChange,
    restore,
    isRestored: () => restoredRef.current,
    markRestored: (v: boolean) => {
      restoredRef.current = v;
    },
  };
}
