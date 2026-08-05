import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import logo from "@/assets/oventric-full.asset.json";

export type SiteNavbarProps = {
  onSelect: (section: string) => void;
  onCreate?: () => void;
  avatarUrl?: string | null;
  name?: string;
  search?: React.ReactNode;
};

const LINKS: Array<{ label: string; section?: string; to?: string }> = [
  { label: "Market", section: "Marketplace" },
  { label: "Academy", section: "Academy" },
  { label: "Bounties", section: "Bounties" },
  { label: "Circles", section: "Circles" },
  { label: "Blog", to: "/blog" },
  { label: "Help", to: "/help" },
];

export function SiteNavbar({ onSelect, onCreate, avatarUrl, name, search }: SiteNavbarProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const [solid, setSolid] = useState(false);



  useEffect(() => {
    const el = document.getElementById("desktop-home-scroll");
    const target: HTMLElement | Window = el ?? window;
    const read = () => {
      const y = el ? el.scrollTop : window.scrollY;
      setSolid(y > 12);
    };
    read();
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        solid ? "bg-white border-b border-slate-200" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center gap-6 px-8">
        <button type="button" onClick={() => onSelect("Home")} className="shrink-0" aria-label="Oventric home">
          <span className="inline-flex items-center rounded-xl bg-slate-900 px-2.5 py-1.5"><img src={logo.url} alt="Oventric" className="h-6 w-auto object-contain" /></span>
        </button>

        {search && <div className="hidden shrink-0 md:block">{search}</div>}

        <nav className="flex items-center gap-1">
          {LINKS.map((l) =>
            l.to ? (
              <Link
                key={l.label}
                to={l.to}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
              >
                {l.label}
              </Link>
            ) : (
              <button
                key={l.label}
                type="button"
                onClick={() => onSelect(l.section!)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
              >
                {l.label}
              </button>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" strokeWidth={3} /> Sell
            </button>
          )}
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => onSelect("Feed")}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white transition-transform active:scale-95"
              >
                Visit feed <ChevronRight className="h-4 w-4" strokeWidth={3} />
              </button>
              <Link
                to="/dashboard"
                aria-label="Open your dashboard"
                className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200"
              >
                <AvatarImage src={avatarUrl ?? null} alt={name || "You"} loading="eager" />
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openGate("generic")}
                className="h-10 rounded-2xl px-4 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openGate("generic")}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white transition-transform active:scale-95"
              >
                Get started <ChevronRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
