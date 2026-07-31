import { useEffect, useState } from "react";
import logoFull from "@/assets/oventric-full.asset.json";

/**
 * Full-screen boot splash: site logo + an RGB bar that sweeps left → right →
 * left endlessly until the app is mounted and ready.
 */
export function BootSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 450);
    const t2 = setTimeout(() => setVisible(false), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <img
        src={logoFull.url}
        alt=""
        className="h-12 w-auto select-none sm:h-14"
        draggable={false}
      />
      <div className="mt-6 h-[3px] w-40 overflow-hidden rounded-full bg-white/10 sm:w-56">
        <div className="boot-splash-bar h-full w-1/3 rounded-full" />
      </div>
    </div>
  );
}
