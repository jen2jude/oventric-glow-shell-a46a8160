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
  Check,
  Heart,
  MessageCircle,
  Bell,
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
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { CountBadge } from "@/components/oventric/CountBadge";

import { PromoInterstitial } from "@/components/oventric/PromoInterstitial";

import { HubPromoCarousel } from "@/components/oventric/hub/HubPromoCarousel";
import { AllFeaturesSheet } from "@/components/oventric/hub/AllFeaturesSheet";
import { ExploreCategories } from "@/components/oventric/hub/ExploreCategories";
import { FeaturedProductCard } from "@/components/oventric/hub/FeaturedProductCard";
import logoFull from "@/assets/oventric-full-transparent.png";


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
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadNotifs = useUnreadNotificationsCount();
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
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 py-4 md:py-8 space-y-7 pb-24 bg-[#0A0A0B] min-h-screen">
      {/* Brand Header — logo, tagline, notifications, avatar */}
      <section className="flex items-center gap-3">
        <div className="flex flex-col min-w-0">
          <img
            loading="lazy"
            decoding="async"
            src={logoFull}
            alt="Oventric"
            className="h-6 w-auto shrink-0"
          />
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Shop &bull; Connect &bull; Grow
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => (isAuthenticated ? setNotifOpen(true) : openGate("generic"))}
            aria-label="Notifications"
            className="relative h-11 w-11 flex items-center justify-center rounded-full bg-[#141416] border border-white/5 text-white/70 active:scale-95 transition-transform"
          >
            <Bell className="w-5 h-5" strokeWidth={2} />
            <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
          </button>

          <Link
            to={mySlug ? "/profile/$id" : "/"}
            params={mySlug ? { id: mySlug } : undefined}
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                openGate("generic");
              }
            }}
            aria-label="Your profile"
            className="h-11 w-11 rounded-full overflow-hidden border border-white/10 shrink-0 active:scale-95 transition-transform bg-[#141416]"
          >
            <AvatarImage src={avatarUrl} alt={name || "You"} />
          </Link>
        </div>
      </section>

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
      <section>
        <div className="relative overflow-hidden rounded-[10px]">
           <HubPromoCarousel onSelect={goSection} />
        </div>
      </section>

      {/* Explore Categories - mirrors reference: white sentence-case heading, compact glowing icon cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[16px] font-bold text-white">Explore Categories</h2>
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault();
              onSelect("Marketplace");
            }}
            className="text-[13px] font-medium text-white/40 flex items-center gap-1"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <ExploreCategories onSelect={(cat) => {
          if (cat === "Academy") onSelect("Academy");
          else onSelect("Marketplace");
        }} />
      </section>

      {/* Featured This Week - compact 3-up cards, mirrors reference */}
      {products.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[16px] font-bold text-white flex items-center gap-1.5">🔥 Featured This Week</h2>
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault();
                onSelect("Marketplace");
              }}
              className="text-[13px] font-medium text-white/40 flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {products.slice(0, 3).map((p) => (
              <FeaturedProductCard key={p.id} product={{
                ...p,
                priceUSD: p.priceUsd,
                originalCurrency: "USD",
                originalAmount: p.priceUsd,
                fxSnapshot: null,
                rating: 4.7 + Math.random() * 0.3,
                vendor: "Oventric",
                name: p.title
              } as any} />
            ))}
          </div>
        </section>
      )}

      {/* Financial hub card - Mirroring discovery_ref style */}
      <section className="rounded-[10px] border border-white/[0.08] bg-[#141416] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#E5484D]/5 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white/30">Available Balance</span>
              <button
                type="button"
                onClick={toggleBalancesHidden}
                className="text-white/20 hover:text-white/60 transition-colors"
              >
                {balancesHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="text-[42px] font-black tracking-tighter text-white tabular-nums leading-none">
              {isAuthenticated ? hide(main) : formatMoney(0, currency)}
            </div>
          </div>
          <Link to="/wallet/ledger" className="mt-1 h-9 w-9 flex items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/5 active:scale-95 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
           <button 
             onClick={() => onSelect("Wallet")}
             className="h-12 flex items-center justify-center gap-2 rounded-[10px] bg-[#E5484D] text-white text-[14px] font-black uppercase active:scale-[0.97] transition-all shadow-[0_8px_20px_rgba(229,72,77,0.25)]"
           >
             <Plus className="w-4 h-4" strokeWidth={4} /> Add Funds
           </button>
           <button 
             onClick={() => onSelect("Wallet")}
             className="h-12 flex items-center justify-center gap-2 rounded-[10px] bg-white/[0.04] border border-white/10 text-white/90 text-[14px] font-black uppercase active:scale-[0.97] transition-all"
           >
             <ArrowUp className="w-4 h-4" strokeWidth={3} /> Withdraw
           </button>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.05]">
          <div className="space-y-1">
             <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Cashback</div>
             <div className="text-[15px] font-black text-emerald-400">{isAuthenticated ? (balancesHidden ? "••••" : formatMoney(fromUSD(cashback, currency), currency)) : formatMoney(0, currency)}</div>
          </div>
          <div className="space-y-1">
             <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Bounty</div>
             <div className="text-[15px] font-black text-blue-400">{isAuthenticated ? (balancesHidden ? "••••" : formatMoney(fromUSD(bounty, currency), currency)) : formatMoney(0, currency)}</div>
          </div>
          <div className="space-y-1">
             <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Escrow</div>
             <div className="text-[15px] font-black text-rose-400">{isAuthenticated ? (balancesHidden ? "••••" : formatMoney(escrow, currency)) : formatMoney(0, currency)}</div>
          </div>
        </div>
      </section>

      {/* Trending / What's Moving rail */}
      <MiniRail
        title="⚡ What's Moving"
        onSeeAll={() => onSelect("Marketplace")}
        items={products.slice(3, 10).map((p) => ({
          id: p.id,
          title: p.title,
          coverUrl: p.coverUrl,
          meta: `${(Math.random() * 2 + 1).toFixed(1)}k sold`,
          icon: "🔥",
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
            <h2 className="text-[14px] font-black text-white/40 uppercase tracking-[0.2em]">Top Creators</h2>
            <button
              onClick={() => onSelect("Feed")}
              className="text-[11px] font-black text-[#E5484D] uppercase tracking-widest"
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
                  <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-[#141416] border border-white/10 transition-transform duration-300 group-active:scale-90">
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#1A1A1F]">
                      <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                    </div>
                  </div>
                  {u.reputationStars >= 4.5 && (
                    <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-[#E5484D] border-2 border-[#0A0A0B] flex items-center justify-center shadow-lg shadow-[#E5484D]/20">
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 truncate w-[72px] text-center group-hover:text-white transition-colors">
                  {u.displayName.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* From Our Community - Mirroring the social snippet in reference */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-black text-white/40 uppercase tracking-[0.2em]">👥 From Our Community</h2>
          <button onClick={() => onSelect("Feed")} className="text-[11px] font-black text-[#E5484D] uppercase tracking-widest">See all →</button>
        </div>
        
        <div className="rounded-[10px] border border-white/[0.06] bg-[#141416] p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                <AvatarImage src={topUsers[0]?.avatarUrl} alt="TechNerd" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-[13px] font-bold text-white">{topUsers[0]?.displayName || "TechNerd"}</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" strokeWidth={4} />
                  </div>
                </div>
                <span className="text-[10px] font-medium text-white/30">2h ago • Tech & Gadgets</span>
              </div>
            </div>
            <button className="text-white/20 hover:text-white transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-white/80">
              Just got my new MacBook Air from Oventric and I'm loving it! Super fast delivery and great price. 🙌
            </p>
            <div className="aspect-[16/9] w-full rounded-[10px] overflow-hidden bg-[#1A1A1F] border border-white/5">
              <img src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800" alt="MacBook" className="w-full h-full object-cover opacity-80" />
            </div>
          </div>
          
          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2 text-white/40">
              <Heart className="w-[18px] h-[18px] fill-[#E5484D] text-[#E5484D]" />
              <span className="text-[12px] font-bold tabular-nums">342</span>
            </div>
            <div className="flex items-center gap-2 text-white/40">
              <MessageCircle className="w-[18px] h-[18px]" />
              <span className="text-[12px] font-bold tabular-nums">48</span>
            </div>
            <button className="text-white/40 hover:text-white transition-colors">
              <Send className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </section>

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
          className="w-full inline-flex items-center justify-center gap-2 h-14 rounded-[10px] bg-[#141416] border border-white/10 text-white text-[13px] font-black uppercase tracking-widest active:scale-95 transition-transform"
        >
          <KeyRound className="w-4 h-4" strokeWidth={3} /> Connect Account
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
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
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
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[13px] font-black text-white/40 uppercase tracking-[0.2em]">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[11px] font-black text-[#E5484D] uppercase tracking-widest"
        >
          See all →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={it.onClick}
            className="shrink-0 w-28 text-left active:scale-95 transition-transform group"
          >
            <span className="block w-28 h-28 rounded-[10px] overflow-hidden bg-[#141416] border border-white/5 relative">

              {it.coverUrl ? (
                <img loading="lazy" decoding="async"
                  src={it.coverUrl}
                  alt={it.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-white/20">
                  <Newspaper className="w-7 h-7" />
                </span>
              )}
            </span>
            <span className="mt-2 block text-[12px] font-bold text-white line-clamp-1 truncate group-hover:text-[#E5484D] transition-colors">
              {it.title}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(it as any).icon && <span className="text-[10px]">{(it as any).icon}</span>}
              <span className="block text-[10px] text-white/40 font-bold uppercase tracking-wide">{(it as any).meta}</span>
            </div>
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
