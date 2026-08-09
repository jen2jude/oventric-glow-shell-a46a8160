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
  LayoutDashboard,
  MessageSquare,
  Users,
  Newspaper as FeedIcon,
  LifeBuoy,
  ChevronRight,
  KeyRound,
  Star,
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
import { CountBadge } from "@/components/oventric/CountBadge";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { SellSwitcherModal } from "@/components/oventric/SellSwitcherModal";
import { CoursePublishWizard } from "@/components/oventric/CoursePublishWizard";
import type { ChoiceKey } from "@/components/oventric/CreatePanel";
import { getTopUsers, type TopUser } from "@/lib/top-users.functions";

import { PromoInterstitial } from "@/components/oventric/PromoInterstitial";

type Counts = Partial<Record<string, number>>;

export type HubProps = {
  onSelect: (section: string) => void;
  onCreate: (choice?: ChoiceKey) => void;
  onOpenMessages: () => void;
  counts?: Counts;
};

type Tile = {
  label: string;
  icon: typeof Store;
  section?: string;
  to?: string;
  countKey?: string;
};

// Single uniform line-art grid: 2 rows x 4 columns.
const TILES: Tile[] = [
  { label: "Feed", icon: FeedIcon, section: "Feed", countKey: "Feed" },
  { label: "Market", icon: Store, section: "Marketplace", countKey: "Market" },
  { label: "Academy", icon: GraduationCap, section: "Academy", countKey: "Academy" },
  { label: "Bounties", icon: Target, section: "Bounties", countKey: "Bounties" },
  { label: "Circles", icon: Users, section: "Circles" },
  { label: "Messages", icon: MessageSquare, section: "Messages" },
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Help", icon: LifeBuoy, to: "/help" },
];

// Secondary destinations kept reachable as compact text links so no existing
// feature loses its entry point from the home screen.
const MORE_LINKS: Array<{ label: string; to: string }> = [
  { label: "Wallet", to: "" },
  { label: "Advertise", to: "/advertise" },
  { label: "Affiliate", to: "/affiliate" },
  { label: "Blog", to: "/blog" },
];

function fromUSD(usd: number, target: Currency): number {
  return target === "USD" ? usd : usd * usdRate(target);
}

export function HomeHub({ onSelect, onCreate, onOpenMessages, counts }: HubProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  // Same live unread counters the header shows, mirrored onto the hub tiles.
  const unread = useUnreadCounts();
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
  const currency: Currency = country ? baseCurrency : "USD";

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
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 py-4 md:py-6 space-y-5">
      {/* Financial hub card */}
      <section
        className="hub-wallet relative overflow-hidden rounded-2xl border border-white/10 p-4 md:p-5"
        style={{
          backgroundImage: "linear-gradient(145deg, #23232B 0%, #191920 45%, #131318 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-sky-400">Hub</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-3xl md:text-4xl font-extrabold text-white tabular-nums truncate">
                {isAuthenticated ? hide(main) : formatMoney(0, currency)}
              </span>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={toggleBalancesHidden}
                  aria-label={balancesHidden ? "Show balance" : "Hide balance"}
                  className="p-1.5 rounded-full text-slate-500 hover:text-white transition-colors"
                >
                  {balancesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-sm text-slate-200">
                Cashback Wallet:{" "}
                <span className="font-semibold text-white tabular-nums">
                  {isAuthenticated
                    ? balancesHidden
                      ? "••••"
                      : formatMoney(fromUSD(cashback, currency), currency)
                    : formatMoney(0, currency)}
                </span>
              </div>
              <div className="text-sm text-slate-200">
                Pending Payout:{" "}
                <span className="font-semibold text-white tabular-nums">
                  {isAuthenticated
                    ? balancesHidden
                      ? "••••"
                      : formatMoney(escrow + fromUSD(bounty, currency), currency)
                    : formatMoney(0, currency)}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect("Wallet")}
            aria-label="Open wallet"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Wallet <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 border-t border-white/10 pt-3 text-center">
          <button
            type="button"
            onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
            className="border-r border-white/10 py-1 text-sm font-medium text-slate-300 active:text-white transition-colors"
          >
            Fund Wallet
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
            className="py-1 text-sm font-medium text-slate-300 active:text-white transition-colors"
          >
            Request Payout
          </button>
        </div>
      </section>

      {/* Uniform 8-icon navigation grid */}
      <section>
        <div className="grid grid-cols-4 gap-y-5 gap-x-2">
          {TILES.map((t) => {
            const sectionUnread =
              t.label === "Messages"
                ? unread.messages + (unread.sections["Messages"] ?? 0)
                : (unread.sections[t.label] ?? 0);
            const count = (t.countKey ? (counts?.[t.countKey] ?? 0) : 0) + sectionUnread;
            const inner = (
              <span className="flex flex-col items-center gap-2">
                <span className="relative inline-flex items-center justify-center">
                  <t.icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                  <CountBadge count={count} ariaLabel={`${count} new in ${t.label}`} />
                </span>
                <span className="text-[13px] font-medium text-slate-100 leading-tight text-center">
                  {t.label}
                </span>
              </span>
            );
            const cls = "py-1 active:scale-95 transition-transform";
            return t.to ? (
              <Link key={t.label} to={t.to} className={cls}>
                {inner}
              </Link>
            ) : (
              <button
                key={t.label}
                type="button"
                onClick={() => (t.section === "Messages" ? onOpenMessages() : onSelect(t.section!))}
                className={cls}
              >
                {inner}
              </button>
            );
          })}
        </div>

        {/* Secondary destinations */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-medium text-slate-500">
          {MORE_LINKS.map((l) =>
            l.to ? (
              <Link key={l.label} to={l.to} className="hover:text-slate-200 transition-colors">
                {l.label}
              </Link>
            ) : (
              <button
                key={l.label}
                type="button"
                onClick={() => onSelect("Wallet")}
                className="hover:text-slate-200 transition-colors"
              >
                {l.label}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => requireTier(2, () => setSellOpen(true))}
            className="hover:text-slate-200 transition-colors"
          >
            Sell
          </button>
          <button
            type="button"
            onClick={() => requireTier(2, () => setCourseOpen(true))}
            className="hover:text-slate-200 transition-colors"
          >
            Publish course
          </button>
          <button
            type="button"
            onClick={() => onCreate("bounty")}
            className="hover:text-slate-200 transition-colors"
          >
            Post bounty
          </button>
        </div>
      </section>

      {/* Top Users Section */}
      {topUsers.length > 0 && (
        <section className="mt-6 mb-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Top Users
            </h2>
            <button
              onClick={() => onSelect("Feed")}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
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
                  <span className="text-[11px] font-bold text-slate-100 truncate w-16 text-center group-hover:text-blue-400 transition-colors">
                    {u.displayName.split(" ")[0]}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
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

      <PromoInterstitial onSelect={onSelect} />

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
          className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
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
            <span className="block text-[11px] text-emerald-300 font-bold truncate">{it.meta}</span>
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
