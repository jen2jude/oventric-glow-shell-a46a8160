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
import { SpotlightRail } from "@/components/oventric/SpotlightRail";
import { HubPromoCarousel } from "@/components/oventric/hub/HubPromoCarousel";
import { AllFeaturesSheet } from "@/components/oventric/hub/AllFeaturesSheet";

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
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 py-3 md:py-6 space-y-4">
      {/* Greeting + currency */}
      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#1A1A1F]">
            <AvatarImage src={avatarUrl} alt={name || "You"} />
          </span>
          <div className="min-w-0">
            <div className="text-[12px] text-slate-400">{greeting()} 👋</div>
            <div className="truncate text-[19px] font-extrabold text-white">
              {name || "Welcome"}
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#121216] px-3 py-2 text-[12px] font-bold text-white">
          <span aria-hidden>{flagEmoji(country)}</span>
          {currency}
        </span>
      </section>

      {/* Financial hub card */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0F0F13] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-slate-400">Main Balance</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate text-[30px] font-extrabold leading-none text-white tabular-nums">
                {isAuthenticated ? hide(main) : formatMoney(0, currency)}
              </span>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={toggleBalancesHidden}
                  aria-label={balancesHidden ? "Show balance" : "Hide balance"}
                  className="p-1 text-slate-500 transition-colors hover:text-white"
                >
                  {balancesHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect("Wallet")}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-[#17171D] px-3.5 py-2 text-[12px] font-bold text-white"
          >
            Wallet <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SubChip
            label="Cashback"
            value={
              isAuthenticated
                ? balancesHidden
                  ? "••••"
                  : formatMoney(fromUSD(cashback, currency), currency)
                : formatMoney(0, currency)
            }
          />
          <SubChip
            label="Bounty"
            value={
              isAuthenticated
                ? balancesHidden
                  ? "••••"
                  : formatMoney(fromUSD(bounty, currency), currency)
                : formatMoney(0, currency)
            }
          />
          <SubChip
            label="Escrow"
            value={
              isAuthenticated
                ? balancesHidden
                  ? "••••"
                  : formatMoney(escrow, currency)
                : formatMoney(0, currency)
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Add Money", icon: Plus, color: "#E5484D" },
            { label: "Withdraw", icon: ArrowUp, color: "#E7E7EA" },
            { label: "Send Money", icon: Send, color: "#E7E7EA" },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#15151A] py-2.5 text-[12px] font-semibold text-white active:scale-95 transition-transform"
            >
              <a.icon className="h-4 w-4" style={{ color: a.color }} strokeWidth={2.2} />
              {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-5 gap-2">
        {[
          {
            label: "Sell",
            icon: Store,
            color: "#E5484D",
            onClick: () => requireTier(2, () => setSellOpen(true)),
          },
          { label: "Post", icon: PenSquare, color: "#7C6CF6", onClick: () => onCreate("post") },
          {
            label: "Course",
            icon: GraduationCap,
            color: "#A78BFA",
            onClick: () => requireTier(2, () => setCourseOpen(true)),
          },
          { label: "Bounty", icon: Target, color: "#E5484D", onClick: () => onCreate("bounty") },
          {
            label: "More",
            icon: MoreHorizontal,
            color: "#E7E7EA",
            onClick: () => setMoreOpen(true),
          },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={q.onClick}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0F0F13] py-3.5 active:scale-95 transition-transform"
          >
            <q.icon className="h-6 w-6" style={{ color: q.color }} strokeWidth={1.8} />
            <span className="text-[11.5px] font-semibold text-white">{q.label}</span>
          </button>
        ))}
      </section>

      {/* Offer carousel */}
      <HubPromoCarousel onSelect={goSection} />

      {/* Spotlights */}
      <SpotlightRail onSelect={onSelect} />



      {/* Top Users Section */}
      {topUsers.length > 0 && (
        <section className="mt-6 mb-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Top Users
            </h2>
            <button
              onClick={() => onSelect("Feed")}
              className="text-[11px] font-bold text-[#E5484D] hover:text-[#F2686C] transition-colors"
            >
              View all
            </button>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide px-1 snap-x snap-mandatory">
            {topUsers.map((u) => (
              <Link
                key={u.userId}
                to="/profile/$id"
                params={{ id: u.slug }}
                className="flex flex-col items-center gap-2.5 shrink-0 group snap-start"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full group-active:scale-95 transition-transform duration-200 overflow-hidden bg-[#222]">
                    <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-black text-[10px] font-black text-red-600 px-2 py-0.5 rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center min-w-[24px] gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    {u.reputationStars}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] font-bold text-slate-100 truncate w-16 text-center group-hover:text-[#E5484D] transition-colors">
                    {u.displayName.split(" ")[0]}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-[#E5484D]/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Live strips */}
      <MiniRail
        title="Fresh in the market"
        onSeeAll={() => onSelect("Marketplace")}
        items={products.map((p) => ({
          id: p.id,
          title: p.title,
          coverUrl: p.coverUrl,
          meta: safeFormatDisplayPrice({ price_usd: p.priceUsd }, currency),
          onClick: () => onSelect("Marketplace"),
        }))}
      />

      <MiniRail
        title="Learn on Academy"
        onSeeAll={() => onSelect("Academy")}
        items={courses.map((c) => ({
          id: c.id,
          title: c.title,
          coverUrl: c.coverUrl,
          meta: c.isFree ? "Free" : safeFormatDisplayPrice({ price_usd: c.priceUsd }, currency),
          onClick: () => onSelect("Academy"),
        }))}
      />

      <MiniRail
        title="Open bounties"
        onSeeAll={() => onSelect("Bounties")}
        items={bounties.map((b) => ({
          id: b.id,
          title: b.title,
          coverUrl: b.coverUrl,
          meta: safeFormatDisplayPrice({ price_usd: b.amountUsd }, currency),
          onClick: () => onSelect("Bounties"),
        }))}
      />

      {!isAuthenticated && (
        <button
          type="button"
          onClick={() => openGate("generic")}
          className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl rgb-static-border p-[2px]"
        >
          <span className="w-full h-full rounded-2xl bg-[#1E1E24] flex items-center justify-center gap-2 text-white font-bold text-sm">
            <KeyRound className="w-4 h-4" strokeWidth={2.5} /> Connect your account
          </span>
        </button>
      )}

      <PromoInterstitial onSelect={onSelect} returnedToHub={returnedToHub} />

      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <CoursePublishWizard
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        onSaved={() => {
          setCourseOpen(false);
          onSelect("Academy");
        }}
      />
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
                <img
                  src={it.coverUrl}
                  alt={it.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
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
    <div className="rounded-[10px] bg-black/25 border border-white/10 px-2.5 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className="text-xs font-bold text-white tabular-nums truncate">{value}</div>
    </div>
  );
}
