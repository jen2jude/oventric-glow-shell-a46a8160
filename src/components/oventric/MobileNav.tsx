import { Home, ShoppingBag, GraduationCap, Target, Wallet, Plus } from "lucide-react";
import { CountBadge } from "@/components/oventric/CountBadge";
import { Icon3D, type Icon3DTone } from "@/components/oventric/Icon3D";

const left: { icon: typeof Home; label: string; tone: Icon3DTone }[] = [
  { icon: Home, label: "Feed", tone: "sky" },
  { icon: ShoppingBag, label: "Market", tone: "rose" },
];
const right: { icon: typeof Home; label: string; tone: Icon3DTone }[] = [
  { icon: GraduationCap, label: "Academy", tone: "violet" },
  { icon: Target, label: "Bounties", tone: "amber" },
  { icon: Wallet, label: "Wallet", tone: "mint" },
];

export type MobileNavCounts = Partial<Record<"Feed" | "Market" | "Academy" | "Bounties" | "Wallet", number>>;

export function MobileNav({
  onCreate,
  active,
  onSelect,
  counts,
}: {
  onCreate: () => void;
  active: string;
  onSelect: (label: string) => void;
  counts?: MobileNavCounts;
}) {
  const Item = (it: { icon: typeof Home; label: string; tone: Icon3DTone }) => {
    const isActive = active === it.label;
    const count = counts?.[it.label as keyof MobileNavCounts] ?? 0;
    return (
      <button
        key={it.label}
        onClick={() => onSelect(it.label)}
        className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
          isActive ? "text-emerald-400" : "text-white"
        }`}
      >
        <span className="relative">
          <Icon3D icon={it.icon} tone={it.tone} active={isActive} size="sm" ariaLabel={it.label} />
          <CountBadge count={count} ariaLabel={`${count} new in ${it.label}`} />
        </span>
        <span className="text-[10px] font-medium">{it.label}</span>
      </button>
    );
  };

  return (
    <nav
      data-testid="mobile-nav"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 max-w-full bg-[#1E1E24] border-t border-white/10 flex items-center px-2"
      style={{
        height: "calc(4rem + max(env(safe-area-inset-bottom), 0.5rem))",
        paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
      }}
    >
      {left.map(Item)}
      <button
        onClick={onCreate}
        className="relative -mt-8 mx-2 w-14 h-14 rounded-full rgb-static-border shrink-0 flex items-center justify-center p-[2px]"
        aria-label="Create"
      >
        <span className="w-full h-full rounded-full bg-[#1E1E24] flex items-center justify-center">
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </span>
      </button>
      {right.map(Item)}
    </nav>
  );
}
