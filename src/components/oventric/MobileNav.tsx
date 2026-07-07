import { Home, ShoppingBag, GraduationCap, Target, Wallet, Plus } from "lucide-react";
import { useState } from "react";

const left = [
  { icon: Home, label: "Feed" },
  { icon: ShoppingBag, label: "Market" },
];
const right = [
  { icon: GraduationCap, label: "Academy" },
  { icon: Target, label: "Bounties" },
  { icon: Wallet, label: "Wallet" },
];

export function MobileNav({ onCreate }: { onCreate: () => void }) {
  const [active, setActive] = useState("Feed");
  const Item = (it: { icon: typeof Home; label: string }) => {
    const isActive = active === it.label;
    return (
      <button
        key={it.label}
        onClick={() => setActive(it.label)}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
          isActive ? "text-emerald-400" : "text-slate-500"
        }`}
      >
        <it.icon className="w-5 h-5" />
        <span className="text-[10px] font-medium">{it.label}</span>
      </button>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-[#1E1E24] border-t border-white/10 flex items-center px-2">
      {left.map(Item)}
      <button
        onClick={onCreate}
        className="relative -mt-8 mx-2 w-14 h-14 rounded-full rgb-neon-bg shrink-0 flex items-center justify-center"
        aria-label="Create"
      >
        <span className="absolute inset-[2px] rounded-full bg-[#1E1E24] flex items-center justify-center">
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </span>
      </button>
      {right.map(Item)}
    </nav>
  );
}
