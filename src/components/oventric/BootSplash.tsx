import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ShoppingCart, Banknote, Target, GraduationCap, Wallet, MessageCircle } from "lucide-react";
import logoFull from "@/assets/oventric-full-transparent.png";

const ICONS = [
  { Icon: ShoppingCart, color: "#ff4d6d" },
  { Icon: Banknote, color: "#ffb020" },
  { Icon: Target, color: "#22ff88" },
  { Icon: GraduationCap, color: "#00c2ff" },
  { Icon: Wallet, color: "#7aa2ff" },
  { Icon: MessageCircle, color: "#a855f7" },
];

/**
 * Full-screen boot splash: site logo + a row of icons that light up
 * left → right in step with *real* load progress (hydration → route data →
 * document load → fonts/first idle frame) rather than on a fixed loop.
 */
// Only the very first mount of the session may show the splash — later route
// changes inside the app must never re-trigger it.
let splashConsumed = false;

function isStandaloneLaunch() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __oventricStandalone?: boolean;
    navigator: Navigator & { standalone?: boolean };
  };
  if (typeof w.__oventricStandalone === "boolean") return w.__oventricStandalone;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      w.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function BootSplash() {
  const [enabled] = useState(() => {
    if (typeof window === "undefined") return false;
    if (splashConsumed) return false;
    if (!isStandaloneLaunch()) return false;
    splashConsumed = true;
    return true;
  });
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  // Eased value that chases the milestone target, so the sweep still looks
  // smooth when several milestones land in the same frame.
  const [shown, setShown] = useState(0);

  // Milestone weights (sum = 1).
  const [hydrated, setHydrated] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const routeLoading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });

  useEffect(() => {
    // Hand off from the server-rendered pre-hydration splash.
    document.getElementById("oventric-boot")?.remove();
    setHydrated(true);

    const onLoad = () => setDocLoaded(true);
    if (document.readyState === "complete") setDocLoaded(true);
    else window.addEventListener("load", onLoad, { once: true });

    let idle: number | undefined;
    const markAssets = () => {
      const ric = (window as unknown as { requestIdleCallback?: typeof setTimeout })
        .requestIdleCallback;
      idle = (ric ? ric(() => setAssetsReady(true)) : setTimeout(() => setAssetsReady(true), 120)) as unknown as number;
    };
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) fonts.ready.then(markAssets).catch(markAssets);
    else markAssets();

    return () => {
      window.removeEventListener("load", onLoad);
      if (idle) clearTimeout(idle);
    };
  }, []);

  const target =
    (hydrated ? 0.3 : 0.12) +
    (routeLoading ? 0 : 0.28) +
    (docLoaded ? 0.24 : 0) +
    (assetsReady ? 0.18 : 0);

  // Ease `shown` toward `target`; when it reaches 1, fade the splash away.
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    const tick = () => {
      setShown((prev) => {
        const next = prev + (target - prev) * 0.12;
        return next > target - 0.002 ? target : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);

  useEffect(() => {
    if (target < 1 || shown < 0.985) return;
    setFading(true);
    const t = setTimeout(() => setVisible(false), 320);
    return () => clearTimeout(t);
  }, [target, shown]);

  if (!visible) return null;

  const lit = shown * ICONS.length;

  return (
    <div
      aria-hidden
      data-oventric-boot="react"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <img
        src={logoFull}
        alt=""
        className="h-12 w-auto select-none sm:h-14"
        draggable={false}
      />
      <div className="mt-6 flex items-center gap-4 sm:gap-5">
        {ICONS.map(({ Icon, color }, i) => {
          // 0 → not reached, 1 → fully lit; partial for the icon at the edge.
          const level = Math.max(0, Math.min(1, lit - i));
          return (
            <Icon
              key={i}
              className="h-5 w-5 transition-none sm:h-6 sm:w-6"
              strokeWidth={2.2}
              style={{
                color,
                opacity: 0.18 + level * 0.82,
                transform: `translateY(${-3 * level}px) scale(${0.92 + level * 0.2})`,
                filter: level > 0 ? `drop-shadow(0 0 ${10 * level}px currentColor)` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
