import { useEffect, useState } from "react";
import { ShoppingCart, Banknote, Target, GraduationCap, Wallet, MessageCircle } from "lucide-react";
import logoFull from "@/assets/oventric-full.asset.json";

const ICONS = [
  { Icon: ShoppingCart, color: "#ff4d6d" },
  { Icon: Banknote, color: "#ffb020" },
  { Icon: Target, color: "#22ff88" },
  { Icon: GraduationCap, color: "#00c2ff" },
  { Icon: Wallet, color: "#7aa2ff" },
  { Icon: MessageCircle, color: "#a855f7" },
];

/**
 * Full-screen boot splash: site logo + a row of soft-glowing app icons that
 * light up left → right endlessly until the app is mounted and ready.
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
      <div className="mt-6 flex items-center gap-4 sm:gap-5">
        {ICONS.map(({ Icon, color }, i) => (
          <Icon
            key={i}
            className="boot-splash-icon h-5 w-5 sm:h-6 sm:w-6"
            strokeWidth={2.2}
            style={{ color, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}

