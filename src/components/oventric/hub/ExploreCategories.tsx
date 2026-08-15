import {
  Laptop,
  Shirt,
  Home,
  Layers,
  GraduationCap,
  Briefcase,
} from "lucide-react";

export function ExploreCategories({ onSelect }: { onSelect: (cat: string) => void }) {
  const categories = [
    { name: "Tech", icon: Laptop, tint: "text-[#3B82F6]", glow: "bg-[#3B82F6]" },
    { name: "Fashion", icon: Shirt, tint: "text-[#A855F7]", glow: "bg-[#A855F7]" },
    { name: "Home & Living", icon: Home, tint: "text-[#22C55E]", glow: "bg-[#22C55E]" },
    { name: "Digital Assets", icon: Layers, tint: "text-[#F59E0B]", glow: "bg-[#F59E0B]" },
    { name: "Courses", icon: GraduationCap, tint: "text-[#EC4899]", glow: "bg-[#EC4899]" },
    { name: "Jobs", icon: Briefcase, tint: "text-[#2DD4BF]", glow: "bg-[#2DD4BF]" },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((cat) => (
        <button
          key={cat.name}
          type="button"
          onClick={() => onSelect(cat.name)}
          className="group relative shrink-0 w-[86px] rounded-[14px] bg-[#121215] border border-white/[0.06] px-2 pt-4 pb-3 flex flex-col items-center gap-2 active:scale-95 transition-transform overflow-hidden"
        >
          <span
            className={`pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full blur-2xl opacity-20 ${cat.glow}`}
          />
          <cat.icon className={`relative h-[26px] w-[26px] ${cat.tint}`} strokeWidth={1.8} />
          <span className="relative text-[11px] font-semibold leading-tight text-white/90 text-center">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}
