import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Eye,
  EyeOff,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Store,
  Target,
  Newspaper,
  LayoutDashboard,
  Megaphone,
  Gift,
  BookOpen,
  LifeBuoy,
  ChevronRight,
  KeyRound,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getWalletBalances } from "@/lib/wallet.functions";
import { getMyFullProfile } from "@/lib/profiles.functions";
import { getDiscoveryFeed } from "@/lib/discovery.functions";
import { formatMoney, usdRate, safeFormatDisplayPrice } from "@/lib/fx-display";
import { COUNTRY_META } from "@/lib/currency/africa";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CountBadge } from "@/components/oventric/CountBadge";

import homeIcon from "@/assets/home-3d.png.asset.json";
import walletIcon from "@/assets/wallet-3d.webp.asset.json";
import marketIcon from "@/assets/marketplace-3d.png.asset.json";
import academyIcon from "@/assets/academy-3d.png.asset.json";
import bountiesIcon from "@/assets/bounties-3d.webp.asset.json";
import circlesIcon from "@/assets/circles-3d.png.asset.json";
import messageIcon from "@/assets/message-3d.webp.asset.json";

type Counts = Partial<Record<string, number>>;

export type HubProps = {
  onSelect: (section: string) => void;
  onCreate: () => void;
  onOpenMessages: () => void;
  counts?: Counts;
};

type Tile = {
  label: string;
  caption: string;
  img?: string;
  icon?: typeof Store;
  section?: string;
  to?: string;
  countKey?: string;
  tint: string;
};

const TILES: Tile[] = [
  { label: "Feed", caption: "What's new", img: homeIcon.url, section: "Feed", countKey: "Feed", tint: "from-sky-500/25 to-sky-500/5" },
  { label: "Market", caption: "Buy & sell", img: marketIcon.url, section: "Marketplace", countKey: "Market", tint: "from-emerald-500/25 to-emerald-500/5" },
  { label: "Academy", caption: "Learn & earn", img: academyIcon.url, section: "Academy", countKey: "Academy", tint: "from-violet-500/25 to-violet-500/5" },
  { label: "Bounties", caption: "Get paid", img: bountiesIcon.url, section: "Bounties", countKey: "Bounties", tint: "from-amber-500/25 to-amber-500/5" },
  { label: "Wallet", caption: "Money", img: walletIcon.url, section: "Wallet", countKey: "Wallet", tint: "from-emerald-500/25 to-teal-500/5" },
  { label: "Circles", caption: "Communities", img: circlesIcon.url, section: "Circles", tint: "from-pink-500/25 to-pink-500/5" },
  { label: "Messages", caption: "Chat", img: messageIcon.url, section: "Messages", tint: "from-cyan-500/25 to-cyan-500/5" },
  { label: "Dashboard", caption: "Your hub", icon: LayoutDashboard, to: "/dashboard", tint: "from-indigo-500/25 to-indigo-500/5" },
  { label: "Advertise", caption: "Promote", icon: Megaphone, to: "/advertise", tint: "from-orange-500/25 to-orange-500/5" },
  { label: "Affiliate", caption: "Refer & earn", icon: Gift, to: "/affiliate", tint: "from-rose-500/25 to-rose-500/5" },
  { label: "Blog", caption: "Stories", icon: BookOpen, to: "/blog", tint: "from-slate-400/25 to-slate-400/5" },
  { label: "Help", caption: "Support", icon: LifeBuoy, to: "/help", tint: "from-teal-500/25 to-teal-500/5" },
];

function fromUSD(usd: number, target: Currency): number {
  return target === "USD" ? usd : usd * usdRate(target);
}

export function HomeHub({ onSelect, onCreate, onOpenMessages, counts }: HubProps) {
  const { isAuthenticated, openGate } = useAuthGate();
  const { baseCurrency, country, balancesHidden, toggleBalancesHidden, fullName, storeName } = useOnboarding();
  const currency: Currency = country ? baseCurrency : "USD";

  const loadBalances = useServerFn(getWalletBalances);
  const loadProfile = useServerFn(getMyFullProfile);
  const loadDiscovery = useServerFn(getDiscoveryFeed);

  const [main, setMain] = useState(0);
  const [cashback, setCashback] = useState(0);
  const [bounty, setBounty] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string>(fullName || storeName || "");
  const [products, setProducts] = useState<
    Array<{ id: string; title: string; coverUrl: string | null; priceUsd: number }>
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
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` }, () => load())
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadDiscovery]);

  const hide = (v: number) => (balancesHidden ? "••••" : formatMoney(v, currency));
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();
  const flag = country ? COUNTRY_META[country]?.flag ?? "" : "";

  return (
    <div className="hub-enter mx-auto w-full max-w-5xl px-3 md:px-6 py-4 md:py-6 space-y-5">
      {/* Identity row */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link
              to="/dashboard"
              aria-label="Open your dashboard"
              className="w-11 h-11 rounded-full overflow-hidden border border-white/15 shrink-0"
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
        className="hub-wallet relative overflow-hidden rounded-3xl border border-emerald-500/25 p-4 md:p-5"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(20,20,26,0.95) 55%, rgba(20,20,26,1) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-emerald-300/80">Main balance</div>
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
          <SubChip label="Cashback" value={isAuthenticated ? (balancesHidden ? "••••" : formatMoney(fromUSD(cashback, currency), currency)) : "—"} />
          <SubChip label="Bounty" value={isAuthenticated ? (balancesHidden ? "••••" : formatMoney(fromUSD(bounty, currency), currency)) : "—"} />
          <SubChip label="Escrow" value={isAuthenticated ? (balancesHidden ? "••••" : formatMoney(escrow, currency)) : "—"} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-2xl bg-emerald-500 text-[#08130f] font-bold text-sm active:scale-95 transition-transform"
          >
            <ArrowDownToLine className="w-4 h-4" strokeWidth={3} /> Add Money
          </button>
          <button
            type="button"
            onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-2xl bg-[#1E1E24] border border-white/15 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            <ArrowUpFromLine className="w-4 h-4" strokeWidth={3} /> Withdraw
          </button>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-4 gap-2">
        <QuickAction icon={Store} label="Sell" onClick={onCreate} />
        <QuickAction icon={Plus} label="Post" onClick={onCreate} />
        <QuickAction icon={ArrowDownToLine} label="Fund" onClick={() => (isAuthenticated ? onSelect("Wallet") : openGate("generic"))} />
        <QuickAction icon={Target} label="Bounty" onClick={() => onSelect("Bounties")} />
      </section>

      {/* Feature grid */}
      <section>
        <h2 className="text-sm font-bold text-white mb-2">Everything on Oventric</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 md:gap-3">
          {TILES.map((t, i) => {
            const count = t.countKey ? counts?.[t.countKey] ?? 0 : 0;
            const inner = (
              <span className="flex flex-col items-center gap-1.5">
                <span
                  className={`relative w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-b ${t.tint} border border-white/10 flex items-center justify-center`}
                >
                  {t.img ? (
                    <img src={t.img} alt="" aria-hidden className="w-8 h-8 md:w-9 md:h-9 object-contain" loading="eager" />
                  ) : t.icon ? (
                    <t.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                  ) : null}
                  <CountBadge count={count} ariaLabel={`${count} new in ${t.label}`} />
                </span>
                <span className="text-[11px] font-semibold text-white leading-tight text-center">{t.label}</span>
                <span className="text-[9px] text-slate-500 leading-none text-center hidden sm:block">{t.caption}</span>
              </span>
            );
            const cls = "hub-tile p-1.5 rounded-2xl hover:bg-white/5 active:scale-95 transition-transform";
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
      <section className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 [scrollbar-width:none]">
        <PromoCard
          title="Earn 2% cashback"
          body="Every purchase pays you back into your cashback wallet."
          cta="Shop now"
          onClick={() => onSelect("Marketplace")}
          tint="from-emerald-500/25"
        />
        <PromoCard
          title="Refer & earn"
          body="Invite builders and earn from their activity."
          cta="Open affiliate"
          to="/affiliate"
          tint="from-rose-500/25"
        />
        <PromoCard
          title="Advertise on Oventric"
          body="Put your product in front of Africa's builders."
          cta="Start a campaign"
          to="/advertise"
          tint="from-orange-500/25"
        />
      </section>

      {/* Live strip */}
      {products.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white">Fresh in the market</h2>
            <button
              type="button"
              onClick={() => onSelect("Marketplace")}
              className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 [scrollbar-width:none]">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect("Marketplace")}
                className="shrink-0 w-32 text-left active:scale-95 transition-transform"
              >
                <span className="block w-32 h-24 rounded-2xl overflow-hidden bg-[#1E1E24] border border-white/10">
                  {p.coverUrl ? (
                    <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-slate-600">
                      <Newspaper className="w-6 h-6" />
                    </span>
                  )}
                </span>
                <span className="mt-1.5 block text-[11px] font-semibold text-white line-clamp-2 leading-tight">{p.title}</span>
                <span className="block text-[11px] text-emerald-300 font-bold">
                  {safeFormatDisplayPrice({ price_usd: p.priceUsd }, currency)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

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
    </div>
  );
}

function SubChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 border border-white/10 px-2.5 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className="text-xs font-bold text-white tabular-nums truncate">{value}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Store;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-2 rounded-2xl hover:bg-white/5 active:scale-95 transition-transform"
    >
      <span className="w-11 h-11 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center text-white">
        <Icon className="w-5 h-5" strokeWidth={2.5} />
      </span>
      <span className="text-[11px] font-semibold text-slate-200">{label}</span>
    </button>
  );
}

function PromoCard({
  title,
  body,
  cta,
  tint,
  onClick,
  to,
}: {
  title: string;
  body: string;
  cta: string;
  tint: string;
  onClick?: () => void;
  to?: string;
}) {
  const content = (
    <span className={`block h-full rounded-3xl border border-white/10 bg-gradient-to-br ${tint} to-transparent p-4`}>
      <span className="block text-sm font-bold text-white">{title}</span>
      <span className="mt-1 block text-xs text-slate-300 leading-snug">{body}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
        {cta} <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </span>
  );
  const cls = "shrink-0 w-60 text-left active:scale-95 transition-transform";
  return to ? (
    <Link to={to} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
