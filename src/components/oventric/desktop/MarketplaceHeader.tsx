import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShoppingCart, User, Smartphone, Truck, RefreshCcw, Menu, X } from "lucide-react";
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
  { label: "New In", section: "Marketplace", icon: "🆕" },
  { label: "Categories", section: "Marketplace", hasArrow: true },
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
            {/* User Profile */}
            <div className="hidden lg:flex items-center gap-2 cursor-pointer group">
              <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200">
                {isAuthenticated ? (
                  <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex flex-col text-left" onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}>
                <span className="text-[10px] font-bold text-slate-500 uppercase leading-none">Orders &</span>
                <span className="text-[12px] font-black text-slate-900 leading-tight">Account</span>
              </div>
            </div>

            {/* Country/Flag */}
            <div className="hidden sm:flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl">{flag}</span>
              <span className="text-xs font-bold text-slate-900">English</span>
            </div>

            {/* Cart */}
            <button className="relative p-2 text-slate-900 hover:text-emerald-600 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-600 text-white text-[10px] font-black rounded-full px-1">
                99+
              </span>
            </button>

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
              {l.hasArrow && <span className="text-[10px] ml-0.5 opacity-80">▼</span>}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[11px] font-bold">
            <span className="opacity-80">Free returns within 90 days</span>
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
