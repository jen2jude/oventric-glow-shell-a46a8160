import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Eye,
  EyeOff,
  Store,
  Target,
  GraduationCap,
  Newspaper,
  ChevronRight,
  KeyRound,
  Star,
  Plus,
  ArrowUp,
  Send,
  PenSquare,
  MoreHorizontal,
  Search,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getWalletBalances } from "@/lib/wallet.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { getDiscoveryFeed } from "@/lib/discovery.functions";
import { listCourses } from "@/lib/academy.functions";
import { formatMoney, usdRate, safeFormatDisplayPrice } from "@/lib/fx-display";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { CoursePublishWizard } from "@/components/oventric/CoursePublishWizard";
import type { ChoiceKey } from "@/components/oventric/CreatePanel";
import { getTopUsers, type TopUser } from "@/lib/top-users.functions";

import { PromoInterstitial } from "@/components/oventric/PromoInterstitial";

import { HubPromoCarousel } from "@/components/oventric/hub/HubPromoCarousel";
import { AllFeaturesSheet } from "@/components/oventric/hub/AllFeaturesSheet";
import { ExploreCategories } from "@/components/oventric/hub/ExploreCategories";
import { FeaturedProductCard } from "@/components/oventric/hub/FeaturedProductCard";


type Counts = Partial<Record<string, number>>;

export type HubProps = {
  onSelect: (section: string) => void;
  onCreate: (choice?: ChoiceKey) => void;
  onOpenMessages: () => void;
  counts?: Counts;
  returnedToHub?: boolean;
};

/** ISO-2 country code → flag emoji (regional indicator pair). */
function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2 || code === "OT") return "🌍";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fromUSD(usd: number, target: Currency): number {
  return target === "USD" ? usd : usd * usdRate(target);
}

export function HomeHub({ onSelect, onCreate, onOpenMessages, returnedToHub }: HubProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const {
    baseCurrency,
    country,
    balancesHidden,
    toggleBalancesHidden,
    fullName,
    storeName,
    require: requireTier,
  } = useOnboarding();
  const [sellOpen, setSellOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const currency: Currency = country ? baseCurrency : "USD";

  const goSection = (section: string) =>
    section === "Messages" ? onOpenMessages() : onSelect(section);

  const loadBalances = useServerFn(getWalletBalances);
  const loadProfile = useServerFn(getMyFullProfile);
  const loadDiscovery = useServerFn(getDiscoveryFeed);
  const loadCourses = useServerFn(listCourses);
  const loadTopUsers = useServerFn(getTopUsers);

  const [main, setMain] = useState(0);
  const [cashback, setCashback] = useState(0);
  const [bounty, setBounty] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mySlug, setMySlug] = useState<string | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);

  const [name, setName] = useState<string>(fullName || storeName || "");
  const [products, setProducts] = useState<
    Array<{ id: string; title: string; coverUrl: string | null; priceUsd: number }>
  >([]);
  const [courses, setCourses] = useState<
    Array<{ id: string; title: string; coverUrl: string | null; priceUsd: number; isFree: boolean }>
  >([]);
  const [bounties, setBounties] = useState<
    Array<{ id: string; title: string; coverUrl: string | null; amountUsd: number }>
  >([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMain(0);
      setCashback(0);
      setBounty(0);
      setEscrow(0);
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      loadBalances()
        .then((r) => {
          if (cancelled) return;
          setMain(r.balances[baseCurrency] ?? 0);
          setEscrow(r.escrow[baseCurrency] ?? 0);
          setCashback(r.cashback ?? 0);
          setBounty(r.bountyBalance ?? 0);
        })
        .catch(() => {});
    };
    load();
    loadProfile()
      .then((r) => {
        if (cancelled || !r?.profile) return;
        setAvatarUrl(r.profile.avatarUrl ?? null);
        setMySlug(r.profile.slug ?? null);
        if (r.profile.displayName) setName(r.profile.displayName);
      })
      .catch(() => {});

    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      ch = supabase
        .channel(`hub-wallet-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` },
          () => load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [isAuthenticated, baseCurrency, loadBalances, loadProfile]);

  useEffect(() => {
    let cancelled = false;
    loadDiscovery()
      .then((r) => {
        if (cancelled) return;
        setProducts((r?.products ?? []).slice(0, 10));
        setBounties(
          (r?.bounties ?? []).slice(0, 10).map((b) => ({
            id: b.id,
            title: b.title,
            coverUrl: b.coverUrl,
            amountUsd: b.amountUsd,
          })),
        );
      })
      .catch(() => {});
    loadTopUsers()
      .then((r) => {
        if (cancelled) return;
        setTopUsers(r.users);
      })
      .catch(() => {});
    loadCourses()
      .then((rows) => {
        if (cancelled) return;
        setCourses(
          (rows ?? []).slice(0, 10).map((c) => ({
            id: c.id,
            title: c.title,
            coverUrl: c.coverUrl,
            priceUsd: c.priceUSD,
            isFree: c.isFree,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadDiscovery, loadCourses]);

  const hide = (v: number) => (balancesHidden ? "••••" : formatMoney(v, currency));

  return (
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 py-4 md:py-8 space-y-7 pb-24">
      {/* Search Header */}
      <section className="flex items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30 group-focus-within:text-[#E5484D] transition-colors" />
          <input 
            type="text"
            placeholder="Search products, shops, people..."
            className="w-full h-[52px] pl-11 pr-4 rounded-[10px] bg-[#141416] border border-white/5 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-[#E5484D]/40 transition-all"
          />
        </div>
        <button className="h-[52px] w-[52px] flex items-center justify-center rounded-[10px] bg-[#141416] border border-white/5 text-white/40 active:scale-95 transition-transform">
          <Filter className="w-5 h-5" />
        </button>
      </section>

      {/* Hero Section */}
      <section className="space-y-4">
        <div className="flex items-end justify-between px-1">
          <div className="space-y-1">
            <h1 className="text-[32px] font-black leading-[0.95] tracking-tight text-white uppercase italic">
              Discover<br/>Amazing<br/>Things
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#121216] px-3 py-1.5 text-[11px] font-bold text-white/60">
            <span aria-hidden>{flagEmoji(country)}</span>
            {currency}
          </div>
        </div>
        
        {/* Main Featured Promo (reusing carousel but adapted style if needed) */}
        <div className="relative overflow-hidden rounded-[10px]">
           <HubPromoCarousel onSelect={goSection} />
        </div>
      </section>

      {/* Financial hub card - Simplified & Bold */}
      <section className="rounded-[10px] border border-white/[0.08] bg-gradient-to-br from-[#131316] to-[#0A0A0B] p-5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#E5484D]/5 blur-[60px] rounded-full group-hover:bg-[#E5484D]/10 transition-colors" />
        
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/30">Total Balance</span>
              <button
                type="button"
                onClick={toggleBalancesHidden}
                className="text-white/20 hover:text-white/60 transition-colors"
              >
                {balancesHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="text-[34px] font-black tracking-tight text-white tabular-nums leading-none">
              {isAuthenticated ? hide(main) : formatMoney(0, currency)}
            </div>
          </div>
          <Link to="/wallet/ledger" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/5 active:scale-95 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="space-y-1">
             <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Cashback</div>
             <div className="text-sm font-bold text-emerald-400">{isAuthenticated ? (balancesHidden ? "••••" : formatMoney(fromUSD(cashback, currency), currency)) : formatMoney(0, currency)}</div>
          </div>
          <div className="space-y-1">
             <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Bounty</div>
             <div className="text-sm font-bold text-blue-400">{isAuthenticated ? (balancesHidden ? "••••" : formatMoney(fromUSD(bounty, currency), currency)) : formatMoney(0, currency)}</div>
          </div>
          <div className="space-y-1">
             <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Escrow</div>
             <div className="text-sm font-bold text-rose-400">{isAuthenticated ? (balancesHidden ? "••••" : formatMoney(escrow, currency)) : formatMoney(0, currency)}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
           <button 
             onClick={() => onSelect("Wallet")}
             className="flex-1 h-11 flex items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] text-white text-[13px] font-bold active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(229,72,77,0.25)]"
           >
             <Plus className="w-4 h-4" strokeWidth={3} /> Add Funds
           </button>
           <button 
             onClick={() => onSelect("Wallet")}
             className="flex-1 h-11 flex items-center justify-center gap-2 rounded-[10px] bg-white/5 border border-white/5 text-white/80 text-[13px] font-bold active:scale-[0.97] transition-all"
           >
             <ArrowUp className="w-4 h-4" strokeWidth={2.5} /> Withdraw
           </button>
        </div>
      </section>

      {/* Explore Categories - Mirroring square glowing grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[17px] font-black text-white uppercase tracking-tight">Explore Categories</h2>
          <Link to="/" onClick={(e) => { e.preventDefault(); onSelect("Marketplace"); }} className="text-[12px] font-bold text-[#E5484D] uppercase">View All</Link>
        </div>
        <ExploreCategories onSelect={(cat) => {
          if (cat === "Academy") onSelect("Academy");
          else onSelect("Marketplace");
        }} />
      </section>

      {/* Featured This Week - 3-up style cards */}
      {products.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-black text-white uppercase tracking-tight">Featured This Week</h2>
            <div className="flex gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
               <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
               <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="space-y-3">
            {products.slice(0, 3).map((p) => (
              <FeaturedProductCard key={p.id} product={{
                ...p,
                priceUSD: p.priceUsd,
                originalCurrency: "USD",
                originalAmount: p.priceUsd,
                fxSnapshot: null,
                rating: 5.0,
                vendor: "Oventric",
                name: p.title
              } as any} />
            ))}
          </div>
        </section>
      )}

      {/* Trending / What's Moving rail */}
      <MiniRail
        title="What's Moving 🔥"
        onSeeAll={() => onSelect("Marketplace")}
        items={products.slice(3, 10).map((p) => ({
          id: p.id,
          title: p.title,
          coverUrl: p.coverUrl,
          meta: safeFormatDisplayPrice({ price_usd: p.priceUsd }, currency),
          onClick: () => onSelect("Marketplace"),
        }))}
      />

      {/* Academy & Bounties in same UI style */}
      <MiniRail
        title="Academy Trending"
        onSeeAll={() => onSelect("Academy")}
        items={courses.map((c) => ({
          id: c.id,
          title: c.title,
          coverUrl: c.coverUrl,
          meta: c.isFree ? "Free" : safeFormatDisplayPrice({ price_usd: c.priceUsd }, currency),
          onClick: () => onSelect("Academy"),
        }))}
      />

      {/* Top Creators - Refined circle rail */}
      {topUsers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-black text-white uppercase tracking-tight">Top Creators</h2>
            <button
              onClick={() => onSelect("Feed")}
              className="text-[12px] font-bold text-[#E5484D] uppercase"
            >
              See all
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1 snap-x snap-mandatory">
            {topUsers.map((u) => (
              <Link
                key={u.userId}
                to="/profile/$id"
                params={{ id: u.slug }}
                className="flex flex-col items-center gap-2 shrink-0 group snap-start"
              >
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-gradient-to-tr from-[#E5484D] to-purple-600 transition-transform duration-300 group-active:scale-90 shadow-[0_0_15px_rgba(229,72,77,0.15)]">
                    <div className="w-full h-full rounded-full border-[3px] border-[#0A0A0B] overflow-hidden bg-[#1A1A1F]">
                      <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                    </div>
                  </div>
                  {u.verified && (
                    <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-blue-500 border-2 border-[#0A0A0B] flex items-center justify-center shadow-lg">
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-bold text-white/70 truncate w-[72px] text-center group-hover:text-white transition-colors">
                  {u.displayName.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Floating Action Button for Create (mirrored from App Chrome if not present) */}
      <div className="fixed bottom-24 right-6 z-50">
        <button 
          onClick={() => onCreate()}
          className="h-14 w-14 flex items-center justify-center rounded-full bg-[#E5484D] text-white shadow-[0_8px_25px_rgba(229,72,77,0.4)] active:scale-90 transition-all border border-white/10"
        >
          <Plus className="w-7 h-7" strokeWidth={3} />
        </button>
      </div>

      {!isAuthenticated && (
        <button
          type="button"
          onClick={() => openGate("generic")}
          className="w-full inline-flex items-center justify-center gap-2 h-14 rounded-[10px] bg-white/5 border border-white/10 text-white font-bold text-sm active:scale-95 transition-transform"
        >
          <KeyRound className="w-4 h-4" strokeWidth={2.5} /> Connect Account
        </button>
      )}

      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <CoursePublishWizard
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        onSaved={() => {
          setCourseOpen(false);
          onSelect("Academy");
        }}
      />
      <AllFeaturesSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSelect={goSection}
        onSell={() => requireTier(2, () => setSellOpen(true))}
      />
      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
    </div>
  );
}



type MiniRailItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  meta: string;
  onClick: () => void;
};

function MiniRail({
  title,
  items,
  onSeeAll,
}: {
  title: string;
  items: MiniRailItem[];
  onSeeAll: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs font-semibold text-[#E5484D] hover:text-[#F2686C] inline-flex items-center gap-1"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 [scrollbar-width:none]">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={it.onClick}
            className="shrink-0 w-32 text-left active:scale-95 transition-transform"
          >
            <span className="block w-32 h-24 rounded-none overflow-hidden bg-[#1E1E24] border border-white/10">
              {it.coverUrl ? (
                <img loading="lazy" decoding="async"
                  src={it.coverUrl}
                  alt={it.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-slate-600">
                  <Newspaper className="w-6 h-6" />
                </span>
              )}
            </span>
            <span className="mt-1.5 block h-[28px] text-[11px] font-semibold text-white line-clamp-2 leading-[14px] overflow-hidden">
              {it.title}
            </span>
            <span className="block text-[11px] text-[#E5484D] font-bold truncate">{it.meta}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SubChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-black/25 border border-white/10 px-2.5 py-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className="text-xs font-bold text-white tabular-nums truncate">{value}</div>
    </div>
  );
}
