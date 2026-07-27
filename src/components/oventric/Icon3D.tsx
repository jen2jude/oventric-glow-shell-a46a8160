import type { LucideIcon } from "lucide-react";

export type Icon3DTone =
  | "emerald"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "coral"
  | "mint"
  | "sun"
  | "slate";

const TONES: Record<
  Icon3DTone,
  { from: string; to: string; ring: string; shadow: string }
> = {
  emerald: { from: "#34d399", to: "#047857", ring: "#065f46", shadow: "rgba(4,120,87,0.45)" },
  amber:   { from: "#fcd34d", to: "#b45309", ring: "#78350f", shadow: "rgba(180,83,9,0.45)" },
  rose:    { from: "#fda4af", to: "#be123c", ring: "#881337", shadow: "rgba(190,18,60,0.45)" },
  sky:     { from: "#7dd3fc", to: "#0369a1", ring: "#0c4a6e", shadow: "rgba(3,105,161,0.45)" },
  violet:  { from: "#c4b5fd", to: "#6d28d9", ring: "#4c1d95", shadow: "rgba(109,40,217,0.45)" },
  coral:   { from: "#fdba74", to: "#c2410c", ring: "#7c2d12", shadow: "rgba(194,65,12,0.45)" },
  mint:    { from: "#6ee7b7", to: "#0f766e", ring: "#134e4a", shadow: "rgba(15,118,110,0.45)" },
  sun:     { from: "#fde68a", to: "#ca8a04", ring: "#713f12", shadow: "rgba(202,138,4,0.45)" },
  slate:   { from: "#cbd5e1", to: "#334155", ring: "#0f172a", shadow: "rgba(15,23,42,0.45)" },
};

export function Icon3D({
  icon: Icon,
  active = false,
  size = "md",
  tone = "slate",
  ariaLabel,
}: {
  icon: LucideIcon;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: Icon3DTone;
  ariaLabel?: string;
}) {
  const dims =
    size === "sm" ? "w-9 h-9" : size === "lg" ? "w-14 h-14" : "w-11 h-11";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;
  const t = TONES[tone];

  return (
    <span
      aria-label={ariaLabel}
      className={[
        "relative inline-flex items-center justify-center rounded-[35%] transition-transform duration-150 shrink-0",
        dims,
        active ? "-translate-y-0.5 scale-105" : "",
      ].join(" ")}
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, ${t.from} 0%, ${t.to} 70%, ${t.ring} 100%)`,
        boxShadow: [
          `0 6px 12px -2px ${t.shadow}`,
          `inset 0 2px 3px rgba(255,255,255,0.55)`,
          `inset 0 -3px 5px ${t.ring}`,
          `inset 0 0 0 1px ${t.ring}`,
        ].join(", "),
        color: "#fff",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[18%] top-[10%] h-[28%] rounded-full"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0))",
          filter: "blur(0.5px)",
        }}
      />
      <Icon
        size={iconSize}
        strokeWidth={2.4}
        className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
      />
    </span>
  );
}
