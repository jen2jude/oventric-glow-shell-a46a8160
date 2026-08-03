import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Target,
  GraduationCap,
  Wallet as WalletIcon,
  Download,
  Store,
  Truck,
  Package,
  Users,
  ChevronDown,
  Plus,
  Compass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { getProfileByIdOrSlug } from "@/lib/profiles.functions";
import { getCircleCatalog, type CircleSummary } from "@/lib/circles-groups.functions";

type DashItem = { label: string; tab: string; icon: typeof Target };

const DASH_ITEMS: DashItem[] = [
  { label: "Overview", tab: "overview", icon: LayoutDashboard },
  { label: "Bounties", tab: "bounties", icon: Target },
  { label: "Courses", tab: "courses", icon: GraduationCap },
  { label: "Wallet", tab: "wallet", icon: WalletIcon },
  { label: "Purchases", tab: "digital", icon: Download },
  { label: "Sales", tab: "sales", icon: Store },
  { label: "Physical orders", tab: "physical", icon: Truck },
  { label: "My listings", tab: "listings", icon: Package },
  { label: "Social", tab: "social", icon: Users },
];

const LEGAL = [
  { label: "About", to: "/about" },
  { label: "Help", to: "/help" },
  { label: "FAQ", to: "/faq" },
  { label: "Blog", to: "/blog" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

function Row({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function MoreToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </span>
      {open ? "Show less" : label}
    </button>
  );
}

function CircleRow({ c, onOpen }: { c: CircleSummary; onOpen: (slug: string) => void }) {
  return (
    <Row onClick={() => onOpen(c.slug)}>
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
        {c.avatarUrl ? (
          <AvatarImage src={c.avatarUrl} alt={c.name} className="rounded-lg" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-lg bg-white/10 text-sm">
            {c.emoji || "◎"}
          </span>
        )}
      </span>
      <span className="truncate">{c.name}</span>
    </Row>
  );
}

export function DesktopAppSidebar({ onSelect }: { onSelect: (section: string) => void }) {
  const profileFn = useServerFn(getProfileByIdOrSlug);
  const catalogFn = useServerFn(getCircleCatalog);

  const [me, setMe] = useState<{ name: string; slug: string; avatarUrl: string | null } | null>(null);
  const [mine, setMine] = useState<CircleSummary[]>([]);
  const [recs, setRecs] = useState<CircleSummary[]>([]);

  const [moreDash, setMoreDash] = useState(false);
  const [moreMine, setMoreMine] = useState(false);
  const [moreRecs, setMoreRecs] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !alive) return;
      try {
        const res = await profileFn({ data: { idOrSlug: uid } });
        if (alive && res.profile) {
          setMe({
            name: res.profile.displayName,
            slug: res.profile.slug,
            avatarUrl: res.profile.avatarUrl,
          });
        }
      } catch (e) {
        console.error("[DesktopAppSidebar] profile load failed", e);
      }
      try {
        const cat = await catalogFn();
        if (!alive) return;
        setMine(cat.mine ?? []);
        setRecs((cat.trending ?? []).filter((c) => c.myRole === null).slice(0, 8));
      } catch (e) {
        console.error("[DesktopAppSidebar] circles load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileFn, catalogFn]);

  const dashVisible = useMemo(() => (moreDash ? DASH_ITEMS : DASH_ITEMS.slice(0, 5)), [moreDash]);
  const mineVisible = moreMine ? mine : mine.slice(0, 3);
  const recsVisible = moreRecs ? recs : recs.slice(0, 3);

  const openCircle = (slug: string) => {
    onSelect("Circles");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("oventric:circle:open-slug", { detail: { slug } }));
    }, 120);
  };

  return (
    <aside className="hidden md:flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#17171B] px-3 py-4">
      {/* Identity */}
      <Link
        to="/profile/$id"
        params={{ id: me?.slug ?? "me" }}
        className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/10"
      >
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
          <AvatarImage src={me?.avatarUrl ?? null} alt={me?.name || "You"} loading="eager" />
        </span>
        <span className="truncate text-sm font-bold text-white">{me?.name || "Your profile"}</span>
      </Link>

      <div className="my-3 h-px bg-white/10" />

      {/* Dashboard shortcuts */}
      <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">My dashboard</p>
      <nav className="flex flex-col">
        {dashVisible.map((it) => (
          <Link
            key={it.tab}
            to="/dashboard"
            search={{ tab: it.tab }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <it.icon className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="truncate">{it.label}</span>
          </Link>
        ))}
        <MoreToggle open={moreDash} onToggle={() => setMoreDash((v) => !v)} label="See more" />
      </nav>

      <div className="my-3 h-px bg-white/10" />

      {/* My circles */}
      <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Your circles</p>
      <nav className="flex flex-col">
        {mineVisible.map((c) => (
          <CircleRow key={c.id} c={c} onOpen={openCircle} />
        ))}
        {mine.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-500">You haven't joined a circle yet.</p>
        )}
        {mine.length > 3 && (
          <MoreToggle open={moreMine} onToggle={() => setMoreMine((v) => !v)} label={`See all ${mine.length}`} />
        )}
        <Row onClick={() => onSelect("Circles")}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
          Browse circles
        </Row>
      </nav>

      <div className="my-3 h-px bg-white/10" />

      {/* Recommended circles */}
      <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Discover circles</p>
      <nav className="flex flex-col">
        {recsVisible.map((c) => (
          <CircleRow key={c.id} c={c} onOpen={openCircle} />
        ))}
        {recs.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-500">No recommendations right now.</p>
        )}
        {recs.length > 3 && (
          <MoreToggle open={moreRecs} onToggle={() => setMoreRecs((v) => !v)} label={`See all ${recs.length}`} />
        )}
        <Row onClick={() => onSelect("Circles")}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
            <Compass className="h-4 w-4" strokeWidth={2.5} />
          </span>
          Explore all
        </Row>
      </nav>

      <div className="my-3 h-px bg-white/10" />

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-4">
        {LEGAL.map((l) => (
          <Link key={l.to} to={l.to} className="text-[11px] font-medium text-slate-500 hover:text-slate-300">
            {l.label}
          </Link>
        ))}
        <span className="w-full pt-1 text-[11px] text-slate-600">© {new Date().getFullYear()} Oventric</span>
      </div>
    </aside>
  );
}
