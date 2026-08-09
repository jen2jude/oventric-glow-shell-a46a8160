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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [sendSoonOpen, setSendSoonOpen] = useState(false);
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
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);
  const flag = country ? (COUNTRY_META[country]?.flag ?? "") : "";

  return (
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 py-4 md:py-6 space-y-5">
      {/* Identity row */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link
              to="/dashboard"
              aria-label="Open your dashboard"
              className="w-11 h-11 rounded-full overflow-hidden border border-white/15 shrink-0 "
            >
              <AvatarImage src={avatarUrl} alt={name || "You"} loading="eager" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{greeting}</div>
              <div className="text-white font-semibold truncate">{name || "Welcome back"}</div>
            </div>
          </>
        ) : (
          <>
            <span className="w-11 h-11 rounded-full bg-[#1E1E24] border border-white/15 flex items-center justify-center text-white shrink-0">
              <User className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{greeting}</div>
              <div className="text-white font-semibold truncate">Welcome to Oventric</div>
            </div>
          </>
        )}
        <span className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-[#1E1E24] border border-white/10 text-xs font-semibold text-slate-200">
          {flag && <span aria-hidden>{flag}</span>}
          {currency}
        </span>
      </div>

      {/* Wallet card */}
      <section
        className="hub-wallet relative overflow-hidden rounded-[10px] border border-white/10 p-4 md:p-5 hub-card-solid"
        style={{
          background: "oklch(0.2 0 0)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-emerald-300/80">
              Main balance
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-bold text-white tabular-nums truncate">
                {isAuthenticated ? hide(main) : formatMoney(0, currency)}
              </span>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={toggleBalancesHidden}
                  aria-label={balancesHidden ? "Show balance" : "Hide balance"}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  {balancesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect("Wallet")}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Wallet <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <SubChip
            label="Cashback"
            value={
              isAuthenticated
                ? balancesHidden
                  ? "••••"
                  : formatMoney(fromUSD(cashback, currency), currency)
                : "—"
            }
          />
          <SubChip
            label="Bounty"
            value={
              isAuthenticated
                ? balancesHidden
                  ? "••••"
                  : formatMoney(fromUSD(bounty, currency), currency)
                : "—"
            }
          />
          <SubChip
            label="Escrow"
            value={
              isAuthenticated ? (balancesHidden ? "••••" : formatMoney(escrow, currency)) : "—"
            }
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-[10px] bg-slate-500 text-white font-bold text-sm active:scale-95 transition-transform shadow-lg shadow-black/20"
          >
            <ArrowDownToLine className="w-4 h-4 text-[#ff0000]" strokeWidth={3} />{" "}
            <span style={{ color: "white" }}>Add</span>
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-[10px] bg-oklch(0.24 0 0) border border-white/15 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            <ArrowUpFromLine className="w-4 h-4" strokeWidth={3} /> Withdraw
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? setSendSoonOpen(true) : openGate("generic"))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-[10px] bg-oklch(0.24 0 0) border border-white/15 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            <Send className="w-4 h-4" strokeWidth={3} /> Send
          </button>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-4 gap-2">
        <QuickAction
          icon={Store}
          label="Sell"
          onClick={() => requireTier(2, () => setSellOpen(true))}
          className="hub-card-solid  rounded-[10px]"
        />
        <QuickAction
          icon={Plus}
          label="Post"
          onClick={() =>
            requireTier(1, () => {
              onSelect("Feed");
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent("oventric:create", { detail: { kind: "post" } }),
                );
              }, 80);
            })
          }
          className="hub-card-solid  rounded-[10px]"
        />
        <QuickAction
          icon={GraduationCap}
          label="Course"
          onClick={() => requireTier(2, () => setCourseOpen(true))}
          className="hub-card-solid  rounded-[10px]"
        />
        <QuickAction
          icon={Target}
          label="Bounty"
          onClick={() => onCreate("bounty")}
          className="hub-card-solid  rounded-[10px]"
        />
      </section>

      {/* Promo banners */}
      <PromoBanners onSelect={onSelect} />

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

      {/* Feature grid */}

      <section>
        <h2 className="text-sm font-bold text-white mb-2">Everything on Oventric</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 md:gap-3">
          {TILES.map((t, i) => {
            const sectionUnread =
              t.label === "Messages"
                ? unread.messages + (unread.sections["Messages"] ?? 0)
                : (unread.sections[t.label] ?? 0);
            const count = (t.countKey ? (counts?.[t.countKey] ?? 0) : 0) + sectionUnread;
            const inner = (
              <span className="flex flex-col items-center gap-1.5">
                <span
                  className={`relative w-12 h-12 md:w-14 md:h-14 rounded-[10px] bg-gradient-to-b ${t.tint} border border-white/10 flex items-center justify-center hub-card-solid `}
                >
                  {t.img ? (
                    <img
                      src={t.img}
                      alt=""
                      aria-hidden
                      className="w-8 h-8 md:w-9 md:h-9 object-contain"
                      loading="eager"
                    />
                  ) : t.icon ? (
                    <t.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                  ) : null}
                  <CountBadge count={count} ariaLabel={`${count} new in ${t.label}`} />
                </span>
                <span className="text-[11px] font-semibold text-white leading-tight text-center">
                  {t.label}
                </span>
                <span className="text-[9px] text-slate-500 leading-none text-center hidden sm:block">
                  {t.caption}
                </span>
              </span>
            );
            const cls =
              "hub-tile p-1.5 rounded-[10px] hover:bg-white/5 active:scale-95 transition-transform";

            const style = { animationDelay: `${Math.min(i, 11) * 28}ms` } as const;
            return t.to ? (
              <Link key={t.label} to={t.to} className={cls} style={style}>
                {inner}
              </Link>
            ) : (
              <button
                key={t.label}
                type="button"
                style={style}
                onClick={() => (t.section === "Messages" ? onOpenMessages() : onSelect(t.section!))}
                className={cls}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </section>

      {/* Promo rail */}
      <section
        aria-label="Promotions"
        className="flex gap-3 overflow-x-auto overscroll-x-contain touch-pan-x scroll-pl-3 pb-3 pt-1 -mx-3 px-3 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:snap-none"
      >
        <PromoCard
          id="cashback"
          title="Earn 2% cashback"
          highlight="on every order"
          body="Money back into your cashback wallet."
          cta="Shop now"
          onClick={() => onSelect("Marketplace")}
          art={promoCashbackArt}
          gradient="linear-gradient(135deg,#FFD22E 0%,#FFB020 55%,#FF8A3D 100%)"
        />
        <PromoCard
          id="refer"
          title="Refer & earn"
          highlight="both sides win"
          body="Invite builders and earn from their activity."
          cta="Invite friends"
          to="/affiliate"
          search={{ reserve: "1" }}
          art={promoReferArt}
          gradient="linear-gradient(135deg,#7DE2A8 0%,#2ED3A0 55%,#12B39B 100%)"
        />
        <PromoCard
          id="advertise"
          title="Advertise here"
          highlight="reach thousands"
          body="Put your product in front of Africa's builders."
          cta="Start a campaign"
          to="/advertise"
          search={{ start: "image" }}
          art={promoAdvertiseArt}
          gradient="linear-gradient(135deg,#7BC5FF 0%,#3D8DFF 55%,#6B5BFF 100%)"
        />
      </section>

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

      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <CoursePublishWizard
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        onSaved={() => {
          setCourseOpen(false);
          onSelect("Academy");
        }}
      />
      <Dialog open={sendSoonOpen} onOpenChange={setSendSoonOpen}>
        <DialogContent className="sm:max-w-sm bg-[#1E1E24] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-white">Send to users</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Big things coming soon, stay tuned!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setSendSoonOpen(false)}
              className="w-full h-11 rounded-2xl bg-emerald-500 text-[#08130f] font-bold text-sm active:scale-95 transition-transform"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function QuickAction({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: typeof Store;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-2 active:scale-95 transition-transform ${className || "rounded-2xl hover:bg-white/5"}`}
    >
      <span className="w-11 h-11 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center text-white">
        <Icon className="w-5 h-5" strokeWidth={2.5} />
      </span>
      <span className="text-[11px] font-semibold text-slate-200">{label}</span>
    </button>
  );
}

function PromoCard({
  id,
  title,
  highlight,
  body,
  cta,
  art,
  gradient,
  onClick,
  to,
  search,
}: {
  id: string;
  title: string;
  highlight: string;
  body: string;
  cta: string;
  art: string;
  gradient: string;
  onClick?: () => void;
  to?: string;
  search?: Record<string, unknown>;
}) {
  const promo = { id, title, surface: "home_promo_rail" };
  const ref = usePromoImpression<HTMLDivElement>(promo);
  const content = (
    <span
      className="promo-tile-surface relative block h-full min-h-[9.25rem] overflow-hidden rounded-[10px] p-4 pr-[5.5rem] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] sm:pr-24"
      style={{ backgroundImage: gradient }}
    >
      <span className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
      <span className="relative block text-[15px] font-extrabold leading-tight text-slate-900">
        {title}
      </span>
      <span className="relative mt-0.5 block text-[13px] font-bold leading-tight text-slate-900/80">
        {highlight}
      </span>
      <span className="relative mt-1 block text-[11px] leading-snug text-slate-900/65 max-w-[8.5rem]">
        {body}
      </span>
      <span className="promo-tile-cta relative mt-3 inline-flex min-h-[2.25rem] items-center gap-1 rounded-full bg-slate-950 px-4 py-2 text-[11px] font-bold text-white">
        {cta} <ChevronRight className="w-3.5 h-3.5" />
      </span>
      <img
        src={art}
        alt=""
        aria-hidden
        loading="lazy"
        width={768}
        height={768}
        className="promo-tile-art pointer-events-none absolute -bottom-2 right-[-6px] h-[112%] w-auto max-w-none object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)]"
      />
    </span>
  );
  const cls =
    "promo-tile shrink-0 w-[82vw] min-w-[16.5rem] max-w-[20rem] snap-start text-left sm:w-[20rem] md:w-auto md:max-w-none md:shrink";
  const handleClick = () => {
    void trackPromoEvent("click", promo);
    onClick?.();
  };
  return to ? (
    <Link
      ref={ref as unknown as React.Ref<HTMLAnchorElement>}
      to={to}
      search={search as never}
      className={cls}
      onClick={handleClick}
    >
      {content}
    </Link>
  ) : (
    <button
      ref={ref as unknown as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={handleClick}
      className={cls}
    >
      {content}
    </button>
  );
}
