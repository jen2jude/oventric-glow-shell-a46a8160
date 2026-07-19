import { useEffect, useState } from "react";

/**
 * Small RGB-glow numeric badge used across the app to indicate new/unread
 * items. Caps display at "99+" and animates when the number changes.
 */
export function CountBadge({
  count,
  className = "",
  ariaLabel,
  variant = "corner",
}: {
  count: number;
  className?: string;
  ariaLabel?: string;
  /**
   * `corner` — absolute-positioned pill, meant to sit on top of an icon.
   * `inline` — flow badge, meant to sit next to a label (e.g. tab pill).
   */
  variant?: "corner" | "inline";
}) {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (count > 0) setBump((b) => b + 1);
  }, [count]);

  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);

  const base =
    variant === "corner"
      ? "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px]"
      : "inline-flex min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] ml-1";

  return (
    <span
      key={bump}
      aria-label={ariaLabel ?? `${count} new`}
      className={`${base} rgb-pulse-glow bg-[#0b0b0d] border border-emerald-400/60 text-white font-black flex items-center justify-center animate-scale-in ${className}`}
    >
      {label}
    </span>
  );
}
