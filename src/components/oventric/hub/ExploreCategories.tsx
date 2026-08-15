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
    { name: "Tech", icon: Smartphone, color: "from-blue-500 to-cyan-400" },
    { name: "Digital Assets", icon: Layers, color: "from-purple-500 to-fuchsia-400" },
    { name: "Fashion", icon: ShoppingBag, color: "from-rose-500 to-pink-400" },
    { name: "Academy", icon: GraduationCap, color: "from-emerald-500 to-teal-400" },
    { name: "Jobs", icon: BriefcaseBusiness, color: "from-orange-500 to-amber-400" },
    { name: "AI Tools", icon: MonitorPlay, color: "from-indigo-500 to-blue-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {categories.map((cat) => (
        <button
          key={cat.name}
          onClick={() => onSelect(cat.name)}
          className="group flex flex-col items-center gap-2 rounded-[10px] bg-[#141416] p-4 ring-1 ring-white/[0.04] transition-all active:scale-95"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${cat.color}`}>
            <cat.icon className="h-5 w-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white/70 group-hover:text-white">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}
