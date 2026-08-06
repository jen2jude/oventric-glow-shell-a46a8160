import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, User, Smartphone, Truck, RefreshCcw, Menu, X } from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { COUNTRY_META } from "@/lib/currency/africa";
import logo from "@/assets/oventric-logo-dark.png";

export type MarketplaceHeaderProps = {
  onSelect: (section: string) => void;
  avatarUrl?: string | null;
  name?: string;
  search?: React.ReactNode;
};

const RED_LINKS = [
  { label: "Best-Selling Items", section: "Marketplace", icon: "👍" },
  { label: "5-Star Rated", section: "Marketplace", icon: "⭐" },
];

export function MarketplaceHeader({ onSelect, avatarUrl, name, search }: MarketplaceHeaderProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const { country } = useOnboarding();
  const [menuOpen, setMenuOpen] = useState(false);

  const flag = country ? (COUNTRY_META[country]?.flag ?? "") : "";

  return (
    <div className="flex flex-col w-full">
      {/* Top Utility Bar (Black) */}
      <div className="bg-black text-white py-2 px-4 hidden md:block">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Truck className="w-3.5 h-3.5" /> Free shipping on all orders
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCcw className="w-3.5 h-3.5" /> Return within 90d
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/help" className="hover:underline">Help</Link>
            <span className="flex items-center gap-1.5 cursor-pointer">
              <Smartphone className="w-3.5 h-3.5" /> Get the Oventric App
            </span>
          </div>
        </div>
      </div>

      {/* Main Header (White) */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:h-20 lg:gap-8">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onSelect("Home")}
            className="shrink-0"
            aria-label="Oventric home"
          >
            <img src={logo} alt="Oventric" className="h-6 sm:h-8 w-auto object-contain" />
          </button>

          {/* Large Search Bar */}
          <div className="flex-1 max-w-2xl hidden md:block">
            {search || (
              <div className="relative group">
                <input
                  type="text"
                  placeholder="I'm looking for..."
                  className="w-full h-11 pl-5 pr-12 rounded-full border-2 border-slate-900 bg-white text-sm font-medium focus:outline-none"
                />
                <button className="absolute right-0 top-0 h-full aspect-square flex items-center justify-center bg-slate-900 text-white rounded-full transition-transform active:scale-95">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 lg:gap-6 ml-auto">
            {/* User Profile & Localization */}
            <div className="hidden lg:flex items-center gap-4">
              <Link 
                to="/profile/$id"
                params={{ id: isAuthenticated ? (avatarUrl?.split('/')[avatarUrl?.split('/').length - 2] || "me") : "me" }}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 ring-2 ring-white ring-offset-2 ring-offset-slate-50 group-hover:ring-emerald-400 transition-all">
                  {isAuthenticated ? (
                    <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase leading-none">
                    {isAuthenticated ? (name?.split(' ')[0] || "My") : "Guest"}
                  </span>
                  <span className="text-[12px] font-black text-slate-900 leading-tight">Profile & Shop</span>
                </div>
              </Link>

              {/* Country & Currency */}
              <div className="flex flex-col items-end border-l border-slate-100 pl-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg leading-none">{flag}</span>
                  <span className="text-[11px] font-black text-slate-900 uppercase">{country || "NG"}</span>
                </div>
                <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                  Market: {COUNTRY_META[country || "NG"]?.currency || "NGN"}
                </div>
              </div>
            </div>

            {/* Mobile Profile Clickable Image */}
            <div className="lg:hidden flex items-center gap-2">
              <Link 
                to="/profile/$id"
                params={{ id: isAuthenticated ? (avatarUrl?.split('/')[avatarUrl?.split('/').length - 2] || "me") : "me" }}
                className="h-8 w-8 rounded-full overflow-hidden border border-slate-200"
              >
                {isAuthenticated ? (
                  <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 text-slate-900 md:hidden"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Red Brand Strip (Marketplace Links) */}
      <div className="bg-[#E13B2E] text-white hidden md:block">
        <div className="mx-auto max-w-[1200px] flex h-10 items-center gap-6 px-6">
          {RED_LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => onSelect(l.section)}
              className="flex items-center gap-1.5 text-[13px] font-black whitespace-nowrap hover:opacity-90"
            >
              {l.icon && <span>{l.icon}</span>}
              {l.label}
              {"hasArrow" in l && (l as any).hasArrow && <span className="text-[10px] ml-0.5 opacity-80">▼</span>}
            </button>
          ))}
          <div className="ml-auto flex flex-col items-end justify-center h-full">
            <span className="text-[12px] font-black leading-none">Instant Delivery</span>
            <span className="text-[9px] font-bold opacity-80 leading-tight">80% of orders under 5 min</span>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <img src={logo} alt="Oventric" className="h-6 w-auto" />
            <button onClick={() => setMenuOpen(false)}><X className="w-6 h-6" /></button>
          </div>
          <nav className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Main Menu</h3>
              {["Home", "Marketplace", "Academy", "Bounties", "Circles"].map(item => (
                <button
                  key={item}
                  onClick={() => { onSelect(item); setMenuOpen(false); }}
                  className="block w-full text-left text-lg font-black text-slate-900"
                >
                  {item}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
