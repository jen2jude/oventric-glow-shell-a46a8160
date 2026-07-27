import { Home, ShoppingBag, GraduationCap, Target, Wallet, Plus, ChevronLeft, MessageSquare, Users } from "lucide-react";
import { useState } from "react";
import { Icon3D, type Icon3DTone } from "@/components/oventric/Icon3D";

const items: { icon: typeof Home; label: string; tone: Icon3DTone }[] = [
  { icon: Home, label: "Feed", tone: "sky" },
  { icon: MessageSquare, label: "Messages", tone: "coral" },
  { icon: Users, label: "Circles", tone: "sun" },
  { icon: ShoppingBag, label: "Marketplace", tone: "rose" },
  { icon: GraduationCap, label: "Academy", tone: "violet" },
  { icon: Target, label: "Bounties", tone: "amber" },
  { icon: Wallet, label: "Wallet", tone: "mint" },
];

export function Sidebar({
  onCreate,
  active,
  onSelect,
}: {
  onCreate: () => void;
  active: string;
  onSelect: (label: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 bg-[#1E1E24] border-r border-white/10 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        <button
          onClick={onCreate}
          className={`relative group mb-4 mt-2 mx-auto flex items-center justify-center rounded-full rgb-neon-bg ${
            collapsed ? "w-12 h-12" : "w-16 h-16"
          }`}
          aria-label="Create"
        >
          <span className="absolute inset-[2px] rounded-full bg-[#1E1E24] flex items-center justify-center">
            <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </span>
        </button>

        {items.map((it) => {
          const isActive = active === it.label;
          return (
            <button
              key={it.label}
              onClick={() => onSelect(it.label)}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon3D icon={it.icon} tone={it.tone} active={isActive} size="sm" ariaLabel={it.label} />
              {!collapsed && <span className="text-sm font-medium truncate">{it.label}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setCollapsed((v) => !v)}
        className="m-3 p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
      >
        <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </aside>
  );
}
