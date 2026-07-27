import { Home, ShoppingBag, GraduationCap, Target, Wallet, Plus, ChevronLeft, MessageSquare, Users } from "lucide-react";
import { useState } from "react";
import messageIcon3D from "@/assets/message-3d.webp.asset.json";
import homeIcon3D from "@/assets/home-3d.png.asset.json";
import circlesIcon3D from "@/assets/circles-3d.png.asset.json";

const items = [
  { icon: Home, label: "Feed", image: homeIcon3D.url },
  { icon: MessageSquare, label: "Messages", image: messageIcon3D },
  { icon: Users, label: "Circles", image: circlesIcon3D.url },
  { icon: ShoppingBag, label: "Marketplace" },
  { icon: GraduationCap, label: "Academy" },
  { icon: Target, label: "Bounties" },
  { icon: Wallet, label: "Wallet" },
] as Array<{ icon: typeof Home; label: string; image?: string }>;


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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {it.image ? (
                <img
                  src={it.image}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="w-8 h-8 shrink-0 object-contain select-none pointer-events-none -my-1 drop-shadow-[0_4px_8px_rgba(59,130,246,0.35)] transition-transform duration-150 active:scale-90"
                />
              ) : (
                <it.icon className="w-5 h-5 shrink-0" />
              )}
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
