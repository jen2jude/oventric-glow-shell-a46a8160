import { useEffect, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { haptic } from "@/lib/haptics";

/**
 * Native-feeling shell behaviours for the mobile app:
 *  - marks <html> with `standalone-app` when launched from the home screen
 *  - pull-to-refresh at the top of the page
 *  - edge swipe-back gesture
 *
 * All gestures are touch-only and disabled on desktop.
 */
export function AppShellGestures() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const state = useRef({ startY: 0, startX: 0, tracking: false, edge: false });

  // Standalone / installed marker for CSS.
  useEffect(() => {
    const root = document.documentElement;
    const check = () => {
      const standalone =
        (window as unknown as { __oventricStandalone?: boolean }).__oventricStandalone === true ||
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      root.classList.toggle("standalone-app", !!standalone);

    };
    check();
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const THRESHOLD = 72;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      state.current.startY = t.clientY;
      state.current.startX = t.clientX;
      state.current.tracking = window.scrollY <= 0;
      state.current.edge = t.clientX <= 24;
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dy = t.clientY - state.current.startY;
      const dx = t.clientX - state.current.startX;

      if (state.current.tracking && dy > 0 && Math.abs(dx) < 40 && window.scrollY <= 0) {
        setPull(Math.min(dy * 0.45, 96));
      }
    };

    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - state.current.startX;
      const dy = t.clientY - state.current.startY;

      // Edge swipe back
      if (pathname !== "/" && state.current.edge && dx > 90 && Math.abs(dy) < 60) {
        haptic("light");
        router.history.back();
      }

      if (pull >= THRESHOLD * 0.45) {
        haptic("medium");
        setRefreshing(true);
        Promise.resolve(router.invalidate()).finally(() => {
          window.setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 450);
        });
      } else {
        setPull(0);
      }
      state.current.tracking = false;
      state.current.edge = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router, pull]);

  // Light haptic tick on every in-app navigation.
  useEffect(() => {
    haptic("select");
  }, [pathname]);

  const visible = pull > 4 || refreshing;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center md:hidden"
      style={{
        transform: `translateY(${visible ? Math.max(pull, refreshing ? 56 : 0) - 40 : -60}px)`,
        transition: pull === 0 || refreshing ? "transform .25s ease" : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <span className="mt-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#1E1E24] shadow-lg">
        <span
          className={`block h-4 w-4 rounded-full border-2 border-white/25 border-t-emerald-400 ${
            refreshing ? "animate-spin" : ""
          }`}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }}
        />
      </span>
    </div>
  );
}
