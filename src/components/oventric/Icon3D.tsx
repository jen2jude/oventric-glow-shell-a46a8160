import type { LucideIcon } from "lucide-react";

export function Icon3D({
  icon: Icon,
  active = false,
  size = "md",
  ariaLabel,
}: {
  icon: LucideIcon;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}) {
  const dims =
    size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-10 h-10";
  const iconSize = size === "sm" ? 16 : size === "lg" ? 28 : 20;

  return (
    <span
      aria-label={ariaLabel}
      className={[
        "relative inline-flex items-center justify-center rounded-2xl transition-transform duration-150",
        dims,
        active
          ? "bg-gradient-to-b from-emerald-500/90 to-emerald-700 text-white -translate-y-1"
          : "bg-gradient-to-b from-[#2A2A32] to-[#1A1A20] text-white",
      ].join(" ")}
      style={{
        boxShadow: active
          ? "0 8px 0 #064e3b, 0 10px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)"
          : "0 5px 0 #0f0f12, 0 6px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
    </span>
  );
}
