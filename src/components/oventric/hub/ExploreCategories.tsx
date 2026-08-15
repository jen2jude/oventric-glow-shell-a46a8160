import { Link } from "@tanstack/react-router";
import { 
  Smartphone, 
  ShoppingBag, 
  Layers, 
  GraduationCap, 
  BriefcaseBusiness, 
  Palette,
  MonitorPlay
} from "lucide-react";

export function ExploreCategories({ onSelect }: { onSelect: (cat: string) => void }) {
  const categories = [
    { name: "Tech", icon: Smartphone, color: "from-blue-500 to-cyan-400", glow: "shadow-[0_0_20px_rgba(59,130,246,0.3)]" },
    { name: "Digital Assets", icon: Layers, color: "from-purple-500 to-fuchsia-400", glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]" },
    { name: "Fashion", icon: ShoppingBag, color: "from-rose-500 to-pink-400", glow: "shadow-[0_0_20px_rgba(244,63,94,0.3)]" },
    { name: "Academy", icon: GraduationCap, color: "from-emerald-500 to-teal-400", glow: "shadow-[0_0_20px_rgba(16,185,129,0.3)]" },
    { name: "Jobs", icon: BriefcaseBusiness, color: "from-orange-500 to-amber-400", glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]" },
    { name: "AI Tools", icon: MonitorPlay, color: "from-indigo-500 to-blue-400", glow: "shadow-[0_0_20px_rgba(99,102,241,0.3)]" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {categories.map((cat) => (
        <button
          key={cat.name}
          onClick={() => onSelect(cat.name)}
          className="group flex flex-col items-center justify-center aspect-square gap-3 rounded-[10px] bg-[#141416] border border-white/[0.06] transition-all active:scale-95 hover:bg-[#1A1A1E]"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${cat.color} ${cat.glow} group-hover:scale-110 transition-transform`}>
            <cat.icon className="h-6 w-6 text-white" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-tight text-white/50 group-hover:text-white transition-colors">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}
