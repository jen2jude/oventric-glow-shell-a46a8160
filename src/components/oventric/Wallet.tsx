import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { getMyAffiliateReservation } from "@/lib/affiliate.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  Wallet as WalletIcon,
  X,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  Zap,
  TrendingUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { supabase } from "@/integrations/supabase/client";
import { listWalletTransactions, getWalletBalances, getWalletEarnings, transferBountyToMain } from "@/lib/wallet.functions";
import { initPaystackPayment } from "@/lib/paystack.functions";
import {
  listBanksForCurrency,
  resolveBankAccount,
  listMyRecipients,
  createMyRecipient,
  deleteMyRecipient,
  estimatePayoutFee,
  createLivePayout,
  createPayoutRequest,
  type PayoutRecipientDTO,
} from "@/lib/payouts.functions";
import { useKycGate } from "@/lib/kyc-gate/KycGate";

type TxStatus = "success" | "pending" | "failed";
type TxType =
  | "Marketplace Purchase"
  | "Marketplace Sale"
  | "Gig Bounty Escrowed"
  | "Ad Injection Charge"
  | "Affiliate Cashback Payout"
  | "Wallet Top-Up"
  | "Payout Withdrawal"
  | "Cashback Earned";

interface Tx {
  id: string;
  type: TxType;
  amount: number;
  currency: Currency;
  inflow: boolean;
  timestamp: string;
  status: TxStatus;
}

const currencyMeta: Record<
  Currency,
  { symbol: string; label: string; glow: string; ring: string; text: string; dot: string }
> = {
  USD: {
    symbol: "$",
    label: "US Dollar",
    glow: "shadow-[0_0_40px_-10px_rgba(59,130,246,0.55)]",
    ring: "border-sky-500/40",
    text: "text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.55)]",
    dot: "bg-sky-400",
  },
  NGN: {
    symbol: "₦",
    label: "Nigerian Naira",
    glow: "shadow-[0_0_40px_-10px_rgba(16,185,129,0.55)]",
    ring: "border-emerald-500/40",
    text: "text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    dot: "bg-emerald-400",
  },
  GHS: {
    symbol: "₵",
    label: "Ghanaian Cedi",
    glow: "shadow-[0_0_40px_-10px_rgba(234,179,8,0.5)]",
    ring: "border-amber-500/40",
    text: "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]",
    dot: "bg-amber-400",
  },
};

function fmt(n: number, c: Currency) {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: c === "NGN" ? 0 : 2,
    maximumFractionDigits: 2,
  };
  return currencyMeta[c].symbol + n.toLocaleString("en-US", opts);
}

const PAGE_SIZE = 6;

function fmtTs(iso: string) {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return iso;
  }
}

const FX_FROM_USD: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };

export function Wallet() {
  const { balances, cashback, balancesHidden: hide, toggleBalancesHidden, require, setBalances, baseCurrency, country } = useOnboarding();
  const { ensureKyc, verifyLiveness } = useKycGate();
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefillUsd, setAddPrefillUsd] = useState<number | null>(null);
  const [addReturnTo, setAddReturnTo] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [bountyModalOpen, setBountyModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [curFilter, setCurFilter] = useState<"ALL" | Currency>("ALL");
  const [page, setPage] = useState(1);
  const [spend, setSpend] = useState(2500);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // External prompts (e.g. bounty publish flow) can request the top-up modal
  // with a suggested amount already filled in.
  useEffect(() => {
    const onTopup = (e: Event) => {
      const detail = (e as CustomEvent<{ amountUsd?: number; reason?: string; returnTo?: string }>).detail;
      const amt = Number(detail?.amountUsd ?? 0);
      if (amt > 0) setAddPrefillUsd(amt);
      const explicitReturn = typeof detail?.returnTo === "string" && detail.returnTo.startsWith("/") ? detail.returnTo : null;
      const inferredReturn = detail?.reason === "bounty-escrow" ? "/?resume=bounty" : null;
      setAddReturnTo(explicitReturn ?? inferredReturn);
      setAddOpen(true);
    };
    window.addEventListener("oventric:wallet:topup", onTopup);
    return () => window.removeEventListener("oventric:wallet:topup", onTopup);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, curFilter]);

  const fetchList = useServerFn(listWalletTransactions);
  const query = useQuery({
    queryKey: ["wallet-tx", userId, debounced, curFilter, page],
    enabled: authReady && !!userId,
    queryFn: () =>
      fetchList({ data: { search: debounced, currency: curFilter, page, pageSize: PAGE_SIZE } }),
    staleTime: 15_000,
  });

  const fetchBalances = useServerFn(getWalletBalances);
  const balancesQuery = useQuery({
    queryKey: ["wallet-balances", userId],
    enabled: authReady && !!userId,
    queryFn: () => fetchBalances(),
    staleTime: 15_000,
  });
  useEffect(() => {
    const d = balancesQuery.data;
    if (d) setBalances(d.balances, d.escrow, d.cashback);
  }, [balancesQuery.data, setBalances]);

  const fetchEarnings = useServerFn(getWalletEarnings);
  const earningsQuery = useQuery({
    queryKey: ["wallet-earnings", userId],
    enabled: authReady && !!userId,
    queryFn: () => fetchEarnings(),
    staleTime: 15_000,
  });
  const earnings = earningsQuery.data ?? { cashbackUSD: 0, marketplaceHome: 0, marketplaceCurrency: baseCurrency, bountyUSD: 0, affiliateUSD: 0 };

  const fetchAffiliate = useServerFn(getMyAffiliateReservation);
  const affiliateQuery = useQuery({
    queryKey: ["affiliate-reservation", userId],
    enabled: authReady && !!userId,
    queryFn: () => fetchAffiliate(),
    staleTime: 60_000,
  });
  const affiliateReserved = !!affiliateQuery.data;

  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`wallet-tx-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
            queryClient.invalidateQueries({ queryKey: ["wallet-tx", userId] });
            queryClient.invalidateQueries({ queryKey: ["wallet-earnings", userId] });
          if (payload.eventType === "INSERT") {
            toast("New transaction recorded", {
              description: "Your ledger has been updated with a new entry.",
              icon: <WalletIcon className="w-4 h-4 text-emerald-400" />,
            });
          }
        },
      )
      .subscribe();
    const walletChannel = supabase
      .channel(`wallets-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wallet-balances", userId] });
          queryClient.invalidateQueries({ queryKey: ["wallet-earnings", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(walletChannel);
    };
  }, [userId, queryClient]);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  const tier = spend < 1000 ? { pct: 2, label: "Baseline" } : spend <= 5000 ? { pct: 3.5, label: "Elite Tier" } : { pct: 5, label: "Apex Architect" };
  const annualSavings = (spend * 12 * tier.pct) / 100;

  const mask = "••••••";

  return (
    <div className="wallet-mobile-safe max-w-6xl mx-auto w-full px-4 py-6 space-y-6 bg-[#0A0A0C] min-h-full">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl sm:text-3xl font-black text-white tracking-tight">
            Sovereign Wallet
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-currency ledger · cashback engine · payout controls
          </p>
        </div>
        <button
          onClick={toggleBalancesHidden}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-[#222226] bg-[#141418] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
        >
          {hide ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="hidden sm:inline">{hide ? "Show Balances" : "Hide Balances"}</span>
        </button>
      </header>

      {/* 1. Currency Vault — locked to the user's country currency. Non-USD
          bases also show the USD equivalent card so users can compare against
          the global rail without switching currencies. */}
      <section className="space-y-3">
        <div className={`grid grid-cols-1 gap-3 ${baseCurrency !== "USD" ? "md:grid-cols-2" : ""}`}>
          {(() => {
            const m = currencyMeta[baseCurrency];
            const bal = balances[baseCurrency] ?? 0;
            const usdEq = bal / (FX_FROM_USD[baseCurrency] || 1);
            return (
              <>
                <div
                  className={`relative overflow-hidden rounded-2xl border border-[#222226] bg-[#141418] p-5 ${m.glow}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-[2px] ${m.dot}/50`} />
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-9 h-9 rounded-lg border ${m.ring} bg-black/40 flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                        {m.symbol}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{baseCurrency} · Primary</div>
                        <div className="text-[11px] text-slate-500 truncate">{m.label} · locked to {country ?? "profile"}</div>
                      </div>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${m.dot} animate-pulse`} />
                  </div>
                  <div className={`text-2xl sm:text-3xl font-black tabular-nums ${m.text} ${hide ? "blur-sm select-none" : ""}`}>
                    {hide ? mask : fmt(bal, baseCurrency)}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wider">
                    Available balance {baseCurrency !== "USD" && !hide && (
                      <span className="normal-case tracking-normal text-slate-400"> · ≈ ${usdEq.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                    )}
                  </div>
                </div>

                {baseCurrency !== "USD" && (
                  <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-[#141418] p-5 shadow-[0_0_40px_-14px_rgba(56,189,248,0.4)]">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-sky-400/50" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg border border-sky-500/40 bg-black/40 flex items-center justify-center text-white text-sm font-bold shrink-0">$</div>
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">USD · Equivalent</div>
                          <div className="text-[11px] text-slate-500 truncate">Global rail · read-only</div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black tabular-nums text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.55)] ${hide ? "blur-sm select-none" : ""}`}>
                      {hide ? mask : `$${usdEq.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wider">
                      USD value of your {baseCurrency} balance
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Earnings breakdown — three live tiles that top up the main balance */}
        {(() => {
          const fx = FX_FROM_USD[baseCurrency] || 1;
          type Tile = {
            key: string;
            label: string;
            sub: string;
            value: number;
            currency: Currency;
            icon: ReactNode;
            accent: string;
            text: string;
            ring: string;
            soon?: boolean;
            cta?: { label: string; to: string };
          };
          const tiles: Tile[] = [
            {
              key: "cashback",
              label: "Cashback",
              sub: "Spend at checkout only",
              value: earnings.cashbackUSD * fx,
              currency: baseCurrency,
              icon: <Sparkles className="w-4 h-4" />,
              accent: "bg-emerald-500/10",
              text: "text-emerald-300",
              ring: "border-emerald-500/30",
            },
            {
              key: "marketplace",
              label: "Seller Earnings",
              sub: "Marketplace sales",
              value: earnings.marketplaceHome,
              currency: earnings.marketplaceCurrency,
              icon: <WalletIcon className="w-4 h-4" />,
              accent: "bg-cyan-500/10",
              text: "text-cyan-300",
              ring: "border-cyan-500/30",
            },
            {
              key: "bounty",
              label: "Bounty Wallet",
              sub: "Tap to send to main or withdraw",
              value: (balancesQuery.data?.bountyBalance ?? 0) * fx,
              currency: baseCurrency,
              icon: <Zap className="w-4 h-4" />,
              accent: "bg-amber-500/10",
              text: "text-amber-300",
              ring: "border-amber-500/30",
              onClick: () => setBountyModalOpen(true),
            },
            {
              key: "affiliate",
              label: "Affiliate",
              sub: "Referral · soon",
              value: 0,
              currency: baseCurrency,
              icon: <TrendingUp className="w-4 h-4" />,
              accent: "bg-fuchsia-500/10",
              text: "text-fuchsia-300",
              ring: "border-fuchsia-500/30",
              soon: true,
              cta: {
                label: affiliateReserved ? "Reserved ✓" : "Join Now",
                to: "/affiliate",
              },
            },
          ];
          return (
            <div className="wallet-earnings-safe">
              {/* Mobile: dead-flat single-line rows (Chrome Android safe: solid bg, no borders, no tints) */}
              <div className="wallet-earnings-mobile md:hidden">
                {tiles.map((t) => (
                  <div key={t.key} className="wallet-earnings-row">
                    <span className="wallet-earnings-label">
                      {t.label}{t.soon ? " (soon)" : ""}
                    </span>
                    {t.cta ? (
                      <Link
                        to={t.cta.to}
                        className="text-[11px] font-black px-2.5 py-1 rounded-md"
                        style={
                          affiliateReserved
                            ? { backgroundColor: "#065f46", color: "#d1fae5", border: "1px solid #10b981" }
                            : { backgroundColor: "#d946ef", color: "#000000" }
                        }
                      >
                        {t.cta.label}
                      </Link>
                    ) : (
                      <span className="wallet-earnings-value">
                        {hide ? "•••" : fmt(t.value, t.currency)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop: original 3-up tiles */}
              <div className="hidden md:grid grid-cols-4 gap-3">
                {tiles.map((t) => (
                  <div
                    key={t.key}
                    className={`relative overflow-hidden rounded-xl border ${t.ring} bg-[#141418] p-3 ${t.soon && !t.cta ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={`w-6 h-6 rounded-md ${t.accent} ${t.text} flex items-center justify-center shrink-0`}>
                        {t.icon}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold truncate">{t.label}</div>
                    </div>
                    {t.cta ? (
                      <>
                        <Link
                          to={t.cta.to}
                          className="inline-flex items-center justify-center w-full text-xs font-black px-3 py-1.5 rounded-lg"
                          style={
                            affiliateReserved
                              ? { backgroundColor: "#065f46", color: "#d1fae5", border: "1px solid #10b981" }
                              : { backgroundColor: "#d946ef", color: "#000000" }
                          }
                        >
                          {t.cta.label}
                        </Link>
                        <div className="mt-1 text-[10px] text-slate-500 truncate">
                          {affiliateReserved ? "You're on the list" : "Reserve your spot"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`text-base font-black tabular-nums ${t.text} ${hide ? "blur-sm select-none" : ""}`}>
                          {hide ? "•••" : fmt(t.value, t.currency)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                          {t.soon ? "Coming soon" : t.sub}
                        </div>
                      </>
                    )}
                    {t.soon && !t.cta && (
                      <span className="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wider px-1 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                        Soon
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

        })()}

      </section>




      {/* 2. Ingestion & Extraction */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => require(2, () => ensureKyc(() => { setAddReturnTo("/?section=Wallet"); setAddOpen(true); }), "funding")}
          className="group relative overflow-hidden rounded-2xl border border-[#222226] bg-[#141418] p-5 text-left hover:border-emerald-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0">
              <ArrowDownToLine className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white">➕ Fund Wallet</div>
              <div className="text-xs text-slate-400 mt-0.5">For bounties & ad campaigns</div>
            </div>
          </div>
        </button>
        <button
          onClick={() => require(2, () => verifyLiveness(() => setPayoutOpen(true)), "withdraw")}
          className="group relative overflow-hidden rounded-2xl border border-[#222226] bg-[#141418] p-5 text-left hover:border-sky-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-sky-500/40 bg-sky-500/10 flex items-center justify-center shrink-0">
              <ArrowUpFromLine className="w-5 h-5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white">📤 Request Payout</div>
              <div className="text-xs text-slate-400 mt-0.5">Direct to your bank · fee auto-deducted</div>
            </div>
          </div>
        </button>
      </section>

      {/* 3. Transaction Ledger */}
      <section className="rounded-2xl border border-[#222226] bg-[#141418] overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 border-b border-[#222226] sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <WalletIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="truncate text-sm font-bold text-white uppercase tracking-wide">
              Transaction Ledger
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hash, type…"
                className="pl-8 pr-3 py-1.5 rounded-lg border border-[#222226] bg-[#0A0A0C] text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 w-40 sm:w-56"
              />
            </div>
            <select
              value={curFilter}
              onChange={(e) => setCurFilter(e.target.value as "ALL" | Currency)}
              className="px-2.5 py-1.5 rounded-lg border border-[#222226] bg-[#0A0A0C] text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All currencies</option>
              <option value="USD">USD</option>
              <option value="NGN">NGN</option>
              <option value="GHS">GHS</option>
            </select>
            <button
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#222226] bg-[#0A0A0C] text-xs text-slate-300 hover:border-emerald-500/40 disabled:opacity-50"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-[#0F0F12]">
                <th className="px-4 py-2.5 font-semibold">Tx ID</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold text-right">Impact</th>
                <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-[#1c1c20] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">{t.txHash}</td>
                  <td className="px-4 py-3 text-slate-200 whitespace-nowrap">{t.type}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap ${t.inflow ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "text-slate-300"}`}>
                    {t.inflow ? "+" : "-"}{fmt(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtTs(t.occurredAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    {!authReady ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading session…</span>
                    ) : !userId ? (
                      "Sign in to view your transaction ledger."
                    ) : query.isLoading ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Fetching ledger…</span>
                    ) : query.isError ? (
                      `Failed to load: ${(query.error as Error)?.message ?? "unknown error"}`
                    ) : (
                      "No transactions match your filters."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-[#222226] text-xs text-slate-400">
          <div>
            Page <span className="text-slate-200 font-semibold">{pageSafe}</span> of {totalPages} · {total} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe === 1}
              className="px-3 py-1.5 rounded-lg border border-[#222226] bg-[#0A0A0C] hover:border-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe === totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#222226] bg-[#0A0A0C] hover:border-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* 4. Cashback Estimator */}
      <section className="rounded-2xl border border-[#222226] bg-[#141418] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            Cashback Optimization Estimator
          </h2>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          A planning tool. Drag the slider to the amount you expect to spend
          or earn through Oventric each month — marketplace purchases, gig
          bounties funded, ad injections, course sales. The estimator shows
          which cashback tier that volume unlocks (2%, 3.5%, or 5%) and how
          much you'd earn back over a year at that rate. Use it to decide
          how much activity to route through your wallet.
        </p>

        {(() => {
          const fx = FX_FROM_USD[baseCurrency] || 1;
          const spendLocal = spend * fx;
          const maxLocal = 10000 * fx;
          const t1Local = 1000 * fx;
          const t2Local = 5000 * fx;
          const annualLocal = annualSavings * fx;
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Projected Monthly Spend / Gig Volume</span>
                <span className="tabular-nums text-slate-200 font-semibold">
                  {fmt(spendLocal, baseCurrency)}{spend >= 10000 ? "+" : ""}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10000}
                step={100}
                value={spend}
                onChange={(e) => setSpend(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <TierPill active={tier.label === "Baseline"} label="Baseline" desc={`< ${fmt(t1Local, baseCurrency)} · 2%`} />
                <TierPill active={tier.label === "Elite Tier"} label="Elite Tier" desc={`${fmt(t1Local, baseCurrency)}–${fmt(t2Local, baseCurrency)} · 3.5%`} />
                <TierPill active={tier.label === "Apex Architect"} label="Apex" desc={`> ${fmt(t2Local, baseCurrency)} · 5%`} />
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-semibold">
                  Estimated Annual Cashback Earnings
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-black tabular-nums text-emerald-300 drop-shadow-[0_0_16px_rgba(52,211,153,0.7)]">
                  {fmt(annualLocal, baseCurrency)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  at <span className="text-emerald-300 font-semibold">{tier.pct}%</span> {tier.label} multiplier
                </div>
              </div>
            </div>
          );
        })()}
      </section>


      {/* Modals */}
      {addOpen && (
        <AddCapitalModal
          prefillUsd={addPrefillUsd}
          returnTo={addReturnTo}
          onClose={() => {
            setAddOpen(false);
            setAddPrefillUsd(null);
            setAddReturnTo(null);
          }}
        />
      )}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: TxStatus }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
        <CheckCircle2 className="w-3 h-3" /> Success
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 animate-pulse">
        <Clock3 className="w-3 h-3" /> Pending Escrow
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
      <AlertTriangle className="w-3 h-3" /> Failed
    </span>
  );
}

function TierPill({ active, label, desc }: { active: boolean; label: string; desc: string }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-center transition-all ${
        active
          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200 shadow-[0_0_20px_-8px_rgba(52,211,153,0.6)]"
          : "border-[#222226] bg-[#0A0A0C] text-slate-400"
      }`}
    >
      <div className="font-bold text-[11px] uppercase tracking-wider">{label}</div>
      <div className="text-[10px] mt-0.5 opacity-80">{desc}</div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 overscroll-contain" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-[#141418] border border-[#222226] rounded-t-2xl sm:rounded-2xl shadow-2xl slide-up max-h-[90vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 border-b border-[#222226]">
          <h3 className="truncate text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}


function AddCapitalModal({ onClose, prefillUsd, returnTo }: { onClose: () => void; prefillUsd?: number | null; returnTo?: string | null }) {
  const { baseCurrency } = useOnboarding();
  const [pick, setPick] = useState<"card" | "bank" | "momo">("card");

  // Amount is now entered directly in the user's locked home currency —
  // no more silent USD → local FX conversion at charge time.
  const FX_FROM_USD_LOCAL: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };
  const symbol = baseCurrency === "NGN" ? "₦" : baseCurrency === "GHS" ? "₵" : "$";
  const step = baseCurrency === "USD" ? "0.01" : "1";
  const prefillLocal =
    prefillUsd && prefillUsd > 0
      ? baseCurrency === "USD"
        ? prefillUsd.toFixed(2)
        : String(Math.round(prefillUsd * FX_FROM_USD_LOCAL[baseCurrency]))
      : "";

  const [amount, setAmount] = useState<string>(prefillLocal);
  const [busy, setBusy] = useState(false);
  const initPaystack = useServerFn(initPaystackPayment);
  const options = [
    { id: "card" as const, icon: CreditCard, title: "Card Processing Node", sub: "Visa / Mastercard / Verve · secured by Paystack" },
    { id: "bank" as const, icon: Building2, title: "Direct Bank Transfer", sub: "NIP · dynamic virtual account · secured by Paystack" },
    { id: "momo" as const, icon: Smartphone, title: "Mobile Money", sub: "MTN · Vodafone · AirtelTigo (Ghana)" },
  ];
  const hasPrefill = !!(prefillUsd && prefillUsd > 0);
  const numericAmount = Number(amount);
  const formattedCharge =
    baseCurrency === "USD"
      ? numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(numericAmount).toLocaleString();

  const fund = async () => {
    const local = Number(amount);
    if (!(local > 0)) return;
    setBusy(true);
    try {
      // Charge in the user's home currency, exactly what they see on screen.
      const chargeAmount = baseCurrency === "USD" ? Number(local.toFixed(2)) : Math.round(local);
      const channel = pick === "card" ? "card" : pick === "bank" ? "bank_transfer" : "mobile_money";
      const init = await initPaystack({
        data: {
          purpose: "wallet_topup",
          amount: chargeAmount,
          currency: baseCurrency,
          channel,
          ...(returnTo ? { returnTo } : {}),
        },
      });
      window.location.href = init.authorizationUrl;
    } catch (e) {
      toast.error("Could not start payment", { description: e instanceof Error ? e.message : "Try again." });
      setBusy(false);
    }
  };
  return (
    <ModalShell title="Fund Wallet" onClose={onClose}>
      {hasPrefill && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/90 font-semibold">
            Suggested top-up · bounty escrow
          </div>
          <div className="mt-1 text-xs text-slate-300 leading-relaxed">
            Your saved bounty draft needs{" "}
            <span className="text-emerald-300 font-bold">${(prefillUsd ?? 0).toFixed(2)} USD</span>{" "}
            (≈ <span className="text-emerald-300 font-bold">{symbol}{prefillLocal || "0"}</span>)
            to publish. We&apos;ve prefilled the amount below — adjust it if you want a bigger buffer.
          </div>
        </div>
      )}

      <div>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          Amount ({baseCurrency})
        </label>
        <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border border-[#222226] bg-[#0A0A0C] focus-within:border-emerald-500/60 transition-colors">
          <span className="px-3 text-slate-400 text-sm">{symbol}</span>
          <input
            type="number"
            min={0}
            step={step}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={baseCurrency === "USD" ? "0.00" : "0"}
            className="w-full bg-transparent py-2.5 pr-3 text-sm text-white placeholder:text-slate-600 outline-none tabular-nums"
          />
        </div>
        {numericAmount > 0 && (
          <div className="mt-1 text-[11px] text-slate-500">
            You&apos;ll be charged exactly{" "}
            <span className="text-slate-200 font-semibold">
              {symbol}
              {formattedCharge}
            </span>{" "}
            via Paystack — no hidden fees.
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">Select a payment channel — Paystack will handle the secure checkout.</p>
      <div className="space-y-2">
        {options.map((o) => {
          const Icon = o.icon;
          const active = pick === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setPick(o.id)}
              className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                active ? "border-emerald-500/60 bg-emerald-500/5" : "border-[#222226] bg-[#0A0A0C] hover:border-white/20"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${active ? "border-emerald-500/40 bg-emerald-500/10" : "border-[#222226] bg-black/40"}`}>
                <Icon className={`w-4 h-4 ${active ? "text-emerald-300" : "text-slate-400"}`} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white text-sm truncate">{o.title}</div>
                <div className="text-xs text-slate-400 truncate">{o.sub}</div>
              </div>
              {active ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-label="Selected" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={fund}
        disabled={!numericAmount || numericAmount <= 0 || busy}
        className="w-full mt-3 rounded-xl bg-slate-200 hover:bg-white disabled:bg-white/10 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-900 font-extrabold py-3.5 text-base shadow-lg shadow-black/30 border border-white/60 md:border-white/20 inline-flex items-center justify-center gap-2 transition-all"
      >
        {busy ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Paystack…</>
        ) : (
          <>Continue with {pick === "card" ? "Card" : pick === "bank" ? "Bank Transfer" : "Mobile Money"}{numericAmount > 0 ? ` · ${symbol}${formattedCharge}` : ""}</>
        )}
      </button>

      <div className="mt-1 text-[10px] text-slate-500 inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Payments processed securely by Paystack
      </div>
    </ModalShell>
  );
}



type Rail = {
  c: Currency;
  method: "bank" | "momo" | "wire";
  label: string;
  eta: string;
  tone: "emerald" | "amber" | "sky";
  hint: string;
};

const NG_BANKS = [
  "Access Bank",
  "Fidelity Bank",
  "First Bank",
  "First City Monument Bank (FCMB)",
  "GTBank",
  "Kuda Bank",
  "OPay",
  "Palmpay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC",
  "Sterling Bank",
  "UBA",
  "Union Bank",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];
const GH_BANKS = [
  "Absa Bank Ghana",
  "Access Bank Ghana",
  "CalBank",
  "Ecobank Ghana",
  "Fidelity Bank Ghana",
  "GCB Bank",
  "GT Bank Ghana",
  "Stanbic Bank Ghana",
  "Standard Chartered Ghana",
  "Zenith Bank Ghana",
];

function PayoutSuccessSplash({
  amount,
  currency,
  destinationLabel,
  onClose,
}: {
  amount: number;
  currency: "NGN" | "GHS" | "USD";
  destinationLabel: string;
  onClose: () => void;
}) {
  const sym = currencyMeta[currency].symbol;
  const digits = currency === "NGN" ? 0 : 2;
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div className="fixed inset-0 z-[10000] overflow-hidden">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(16,185,129,0.35) 0%, transparent 60%), radial-gradient(circle at 20% 70%, rgba(56,189,248,0.25) 0%, transparent 55%), radial-gradient(circle at 80% 75%, rgba(168,85,247,0.25) 0%, transparent 55%)",
        }}
      />
      <div className="relative h-full w-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-[#0A0F0C] shadow-[0_0_60px_rgba(16,185,129,0.35)] p-6 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(16,185,129,0.6)]">
            <CheckCircle2 className="w-10 h-10 text-black" strokeWidth={3} />
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80 font-bold mb-1">Withdrawal Requested</div>
          <div className="text-3xl font-black text-white tabular-nums mb-1">
            {sym}{amount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}
          </div>
          <div className="text-xs text-slate-400 mb-4 truncate">to {destinationLabel}</div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-left text-xs text-emerald-100/90 mb-4">
            <div className="font-bold text-emerald-200 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> You're all set
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-100/80">
              Our admin team will review and process your payout shortly. You'll receive your money soon — this can take a few hours. We'll notify you the moment it's approved.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 text-sm transition-colors"
          >
            OK, return to wallet
          </button>
        </div>
      </div>
    </div>
  );
}

function PayoutModal({ onClose }: { onClose: () => void }) {
  const { balances, baseCurrency } = useOnboarding();
  const qc = useQueryClient();

  const [step, setStep] = useState<"pick" | "destination" | "amount" | "wire">("pick");
  const [chosenRecipientId, setChosenRecipientId] = useState<string | null>(null);
  const [splash, setSplash] = useState<{ amount: number; currency: "NGN" | "GHS" | "USD"; destinationLabel: string } | null>(null);

  const finalizeWithSplash = (payload: { amount: number; currency: "NGN" | "GHS" | "USD"; destinationLabel: string }) => {
    void qc.invalidateQueries({ queryKey: ["wallet-balances"] });
    void qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    void qc.invalidateQueries({ queryKey: ["wallet-earnings"] });
    setSplash(payload);
  };

  const closeSplash = () => {
    setSplash(null);
    void qc.invalidateQueries({ queryKey: ["wallet-balances"] });
    void qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    onClose();
  };

  if (splash) {
    return (
      <PayoutSuccessSplash
        amount={splash.amount}
        currency={splash.currency}
        destinationLabel={splash.destinationLabel}
        onClose={closeSplash}
      />
    );
  }

  const railFor = (c: Currency): Rail =>
    c === "NGN"
      ? { c: "NGN", method: "bank", label: "NGN Instant Bank Transfer", eta: "< 5 mins", tone: "emerald", hint: "Direct to your Nigerian bank · Paystack" }
      : c === "GHS"
        ? { c: "GHS", method: "momo", label: "GHS Bank / Mobile Money", eta: "< 15 mins", tone: "amber", hint: "MTN · Vodafone · AirtelTigo · GH bank" }
        : { c: "USD", method: "wire", label: "USD International Wire", eta: "24–48 hours", tone: "sky", hint: "SWIFT · manual review" };

  const rail = railFor(baseCurrency);
  const baseBal = balances[baseCurrency] ?? 0;
  const others: Currency[] = (["NGN", "GHS", "USD"] as Currency[]).filter((c) => c !== baseCurrency);

  if (step === "pick") {
    return (
      <ModalShell title="Request Payout" onClose={onClose}>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-200/90">
            Identity verified. Withdrawals are locked to your home currency ({baseCurrency}). Other currencies are shown for reference only.
          </p>
        </div>
        <div className="space-y-2">
          {/* Active rail — user's base currency */}
          <div
            className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left ${
              baseBal > 0 ? "border-sky-500/60 bg-sky-500/5" : "border-[#222226] bg-[#0A0A0C] opacity-70"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                rail.tone === "emerald"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : rail.tone === "amber"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-sky-500/40 bg-sky-500/10 text-sky-300"
              }`}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm truncate">{rail.label}</div>
              <div className="text-xs text-slate-400 truncate">{rail.hint} · {rail.eta}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Available</div>
              <div className="text-xs font-bold text-slate-200 tabular-nums">
                {currencyMeta[rail.c].symbol}
                {baseBal.toLocaleString("en-US", { minimumFractionDigits: rail.c === "NGN" ? 0 : 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Reference — other currency equivalents (view only) */}
          {others.map((c) => {
            const r = railFor(c);
            const baseUsd = baseBal / (FX_FROM_USD[baseCurrency] || 1);
            const equiv = baseUsd * (FX_FROM_USD[c] || 1);
            return (
              <div
                key={c}
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#1a1a1e] bg-[#0A0A0C] opacity-50 p-3 text-left cursor-not-allowed"
                title={`Payouts are locked to your home currency (${baseCurrency})`}
              >
                <div className="w-10 h-10 rounded-lg border border-[#222226] flex items-center justify-center shrink-0 text-slate-500">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-300 text-sm truncate">{r.label}</div>
                  <div className="text-[11px] text-slate-500 truncate">Reference equivalent · not withdrawable</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">≈</div>
                  <div className="text-xs font-bold text-slate-400 tabular-nums">
                    {currencyMeta[c].symbol}
                    {equiv.toLocaleString("en-US", { minimumFractionDigits: c === "NGN" ? 0 : 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          disabled={baseBal <= 0}
          onClick={() => setStep(baseCurrency === "USD" ? "wire" : "destination")}
          className="w-full mt-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {baseBal > 0 ? `Continue with ${baseCurrency}` : `No ${baseCurrency} balance to withdraw`}
        </button>
      </ModalShell>
    );
  }

  if (step === "wire") {
    return (
      <WireForm
        onClose={onClose}
        onBack={() => setStep("pick")}
        max={balances.USD ?? 0}
        onSubmitted={(amt, label) => finalizeWithSplash({ amount: amt, currency: "USD", destinationLabel: label })}
      />
    );
  }

  if (step === "destination") {
    return (
      <DestinationPicker
        currency={baseCurrency as "NGN" | "GHS"}
        onClose={onClose}
        onBack={() => setStep("pick")}
        onPick={(id) => {
          setChosenRecipientId(id);
          setStep("amount");
        }}
      />
    );
  }

  // step === "amount"
  if (!chosenRecipientId) {
    return (
      <DestinationPicker
        currency={baseCurrency as "NGN" | "GHS"}
        onClose={onClose}
        onBack={() => setStep("pick")}
        onPick={(id) => {
          setChosenRecipientId(id);
          setStep("amount");
        }}
      />
    );
  }
  return (
    <AmountStep
      currency={baseCurrency as "NGN" | "GHS"}
      recipientId={chosenRecipientId}
      max={balances[baseCurrency] ?? 0}
      onBack={() => setStep("destination")}
      onSubmitted={(amt, label) => finalizeWithSplash({ amount: amt, currency: baseCurrency as "NGN" | "GHS", destinationLabel: label })}
    />
  );
}


function feeFor(currency: "NGN" | "GHS", method: "bank" | "momo", amount: number): number {
  if (currency === "NGN") {
    if (amount <= 5000) return 10;
    if (amount <= 50000) return 25;
    return 50;
  }
  if (method === "momo") return Number((Math.min(amount * 0.01, 8) + 1).toFixed(2));
  return 1;
}

function DestinationPicker({
  currency,
  onClose,
  onBack,
  onPick,
}: {
  currency: "NGN" | "GHS";
  onClose: () => void;
  onBack: () => void;
  onPick: (id: string) => void;
}) {
  const [mode, setMode] = useState<"list" | "add">("list");
  const listRecipients = useServerFn(listMyRecipients);
  const deleteRec = useServerFn(deleteMyRecipient);
  const [items, setItems] = useState<PayoutRecipientDTO[] | null>(null);

  const reload = async () => {
    try {
      const data = await listRecipients();
      setItems((data as PayoutRecipientDTO[]).filter((r) => r.currency === currency));
    } catch (e) {
      toast.error("Couldn't load saved destinations", { description: (e as Error).message });
    }
  };
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (id: string) => {
    try {
      await deleteRec({ data: { id } });
      toast.success("Destination removed");
      void reload();
    } catch (e) {
      toast.error("Couldn't remove", { description: (e as Error).message });
    }
  };

  if (mode === "add") {
    return (
      <AddRecipientForm
        currency={currency}
        onClose={onClose}
        onBack={() => setMode("list")}
        onSaved={(id) => onPick(id)}
      />
    );
  }

  return (
    <ModalShell title={`${currency} payout destination`} onClose={onClose}>
      <button type="button" onClick={onBack} className="text-[11px] text-slate-400 hover:text-white uppercase tracking-wider">
        ← Change currency
      </button>
      <div className="space-y-2">
        {items === null && <div className="text-xs text-slate-500">Loading saved destinations…</div>}
        {items !== null && items.length === 0 && (
          <div className="text-xs text-slate-500">
            No saved {currency} destinations yet — add one to continue.
          </div>
        )}
        {(items ?? []).map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[#222226] bg-[#0A0A0C] p-3"
          >
            <button
              type="button"
              onClick={() => onPick(r.id)}
              className="text-left min-w-0"
            >
              <div className="text-sm font-semibold text-white truncate">
                {r.account_name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {r.method === "bank"
                  ? `${r.bank_name} · ${r.account_number}`
                  : `${r.momo_network} · ${r.phone}`}
              </div>
            </button>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="text-[11px] text-rose-300 hover:text-rose-200 uppercase tracking-wider"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setMode("add")}
        className="w-full mt-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 font-bold py-2.5 text-sm transition-colors"
      >
        + Add new {currency === "NGN" ? "bank account" : "destination"}
      </button>
    </ModalShell>
  );
}

function AddRecipientForm({
  currency,
  onClose,
  onBack,
  onSaved,
}: {
  currency: "NGN" | "GHS";
  onClose: () => void;
  onBack: () => void;
  onSaved: (recipientId: string) => void;
}) {
  const listBanks = useServerFn(listBanksForCurrency);
  const resolveAcct = useServerFn(resolveBankAccount);
  const createRec = useServerFn(createMyRecipient);

  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [method, setMethod] = useState<"bank" | "momo">(currency === "NGN" ? "bank" : "momo");
  const [bankCode, setBankCode] = useState("");
  const [acctNum, setAcctNum] = useState("");
  const [acctName, setAcctName] = useState("");
  const [network, setNetwork] = useState<"MTN" | "Vodafone" | "AirtelTigo">("MTN");
  const [phone, setPhone] = useState("");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (method !== "bank") return;
    let cancelled = false;
    listBanks({ data: { currency } })
      .then((data) => {
        if (!cancelled) setBanks(data as { name: string; code: string }[]);
      })
      .catch(() => {
        if (!cancelled) setBanks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [method, currency, listBanks]);

  // NG account name auto-resolve after 10 digits.
  useEffect(() => {
    if (currency !== "NGN" || method !== "bank") return;
    if (!bankCode || acctNum.length !== 10) return;
    let cancelled = false;
    setResolving(true);
    setAcctName("");
    resolveAcct({ data: { account_number: acctNum, bank_code: bankCode } })
      .then((r) => {
        if (!cancelled) setAcctName((r as { account_name: string }).account_name);
      })
      .catch((e) => {
        if (!cancelled) toast.error("Couldn't verify account", { description: (e as Error).message });
      })
      .finally(() => !cancelled && setResolving(false));
    return () => {
      cancelled = true;
    };
  }, [bankCode, acctNum, currency, method, resolveAcct]);

  const canSave = () => {
    if (!acctName.trim()) return false;
    if (method === "bank") return !!bankCode && (currency === "NGN" ? /^\d{10}$/.test(acctNum) : acctNum.length >= 6);
    return phone.length >= 9;
  };

  const save = async () => {
    setSaving(true);
    try {
      const bank = banks.find((b) => b.code === bankCode);
      const res = await createRec({
        data: {
          currency,
          method,
          bank_code: method === "bank" ? bankCode : undefined,
          bank_name: method === "bank" ? bank?.name : undefined,
          account_number: method === "bank" ? acctNum : undefined,
          account_name: acctName.trim(),
          momo_network: method === "momo" ? network : undefined,
          phone: method === "momo" ? phone : undefined,
        },
      });
      toast.success("Destination saved");
      onSaved((res as { id: string }).id);
    } catch (e) {
      toast.error("Couldn't save destination", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Add ${currency} destination`} onClose={onClose}>
      <button type="button" onClick={onBack} className="text-[11px] text-slate-400 hover:text-white uppercase tracking-wider">
        ← Back
      </button>

      {currency === "GHS" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("momo")}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${method === "momo" ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-[#222226] bg-[#0A0A0C] text-slate-400"}`}
          >
            Mobile Money
          </button>
          <button
            type="button"
            onClick={() => setMethod("bank")}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${method === "bank" ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-[#222226] bg-[#0A0A0C] text-slate-400"}`}
          >
            Bank Transfer
          </button>
        </div>
      )}

      {method === "bank" ? (
        <>
          <Field label="Bank">
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full rounded-lg border border-[#222226] bg-[#0A0A0C] px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">{banks.length ? "Select bank…" : "Loading banks…"}</option>
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </Field>
          <Field label={currency === "NGN" ? "Account number (10 digits, NUBAN)" : "Account number"}>
            <TxtInput
              value={acctNum}
              onChange={(v) => setAcctNum(v.replace(/\D/g, ""))}
              placeholder={currency === "NGN" ? "0123456789" : "Account number"}
              maxLength={currency === "NGN" ? 10 : 20}
            />
          </Field>
          <Field label={resolving ? "Verifying account name…" : currency === "NGN" ? "Account name (auto-verified)" : "Account name"}>
            <TxtInput
              value={acctName}
              onChange={setAcctName}
              placeholder={currency === "NGN" ? "Will fill after verification" : "Full account holder name"}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Network">
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as never)}
              className="w-full rounded-lg border border-[#222226] bg-[#0A0A0C] px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="MTN">MTN Mobile Money</option>
              <option value="Vodafone">Vodafone Cash</option>
              <option value="AirtelTigo">AirtelTigo Money</option>
            </select>
          </Field>
          <Field label="Mobile number">
            <TxtInput value={phone} onChange={(v) => setPhone(v.replace(/\D/g, ""))} placeholder="233 20 000 0000" />
          </Field>
          <Field label="Registered wallet name">
            <TxtInput value={acctName} onChange={setAcctName} placeholder="Full name on the mobile wallet" />
          </Field>
        </>
      )}

      <button
        onClick={save}
        disabled={!canSave() || saving || resolving}
        className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save destination
      </button>
    </ModalShell>
  );
}

function AmountStep({
  currency,
  recipientId,
  max,
  onBack,
  onSubmitted,
}: {
  currency: "NGN" | "GHS";
  recipientId: string;
  max: number;
  onBack: () => void;
  onSubmitted: (amount: number, destinationLabel: string) => void;
}) {
  const listRec = useServerFn(listMyRecipients);
  const estimateFee = useServerFn(estimatePayoutFee);
  const create = useServerFn(createPayoutRequest);

  const [rec, setRec] = useState<PayoutRecipientDTO | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [serverFee, setServerFee] = useState<{ fee: number; net: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listRec()
      .then((rows) => {
        const found = (rows as PayoutRecipientDTO[]).find((r) => r.id === recipientId) ?? null;
        setRec(found);
      })
      .catch(() => setRec(null));
  }, [listRec, recipientId]);

  const amt = Number(amount);
  const method: "bank" | "momo" = rec?.method ?? "bank";
  const clientFee = amt > 0 ? feeFor(currency, method, amt) : 0;
  const clientNet = Math.max(0, Number((amt - clientFee).toFixed(2)));

  // Re-check with server on debounce for authoritative preview.
  useEffect(() => {
    if (!(amt > 0)) {
      setServerFee(null);
      return;
    }
    const h = setTimeout(() => {
      estimateFee({ data: { currency, method, amount: amt } })
        .then((r) => setServerFee(r as { fee: number; net: number }))
        .catch(() => setServerFee(null));
    }, 250);
    return () => clearTimeout(h);
  }, [amt, currency, method, estimateFee]);

  const fee = serverFee?.fee ?? clientFee;
  const net = serverFee?.net ?? clientNet;
  const sym = currencyMeta[currency].symbol;

  const submit = async () => {
    if (!(amt > 0)) return;
    if (!recipientId || !rec) {
      toast.error("Choose a payout destination first");
      return;
    }
    if (amt > max) {
      toast.error("Amount exceeds available balance");
      return;
    }
    setBusy(true);
    try {
      const destination =
        rec.method === "bank"
          ? {
              account_name: rec.account_name,
              bank_name: rec.bank_name ?? undefined,
              account_number: rec.account_number ?? undefined,
              bank_code: rec.bank_code ?? undefined,
            }
          : {
              account_name: rec.account_name,
              network: (rec.momo_network as "MTN" | "Vodafone" | "AirtelTigo" | undefined) ?? undefined,
              phone: rec.phone ?? undefined,
            };

      await create({
        data: {
          currency,
          method: rec.method,
          amount: amt,
          destination,
        },

      });
      const label =
        rec.method === "bank"
          ? `${rec.bank_name} · ${rec.account_number}`
          : `${rec.momo_network} · ${rec.phone}`;
      onSubmitted(amt, label);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The payout request could not be completed.";
      const friendly = /insufficient balance/i.test(message)
        ? "Your available wallet balance changed before this payout could be sent."
        : message;
      toast.error("Payout failed", { description: friendly });
    } finally {
      setBusy(false);
    }
  };


  return (
    <ModalShell title="Confirm payout" onClose={onBack}>
      <button type="button" onClick={onBack} className="text-[11px] text-slate-400 hover:text-white uppercase tracking-wider">
        ← Change destination
      </button>

      {rec && (
        <div className="rounded-xl border border-[#222226] bg-[#0A0A0C] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sending to</div>
          <div className="text-sm font-semibold text-white truncate">{rec.account_name}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {rec.method === "bank" ? `${rec.bank_name} · ${rec.account_number}` : `${rec.momo_network} · ${rec.phone}`}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#222226] bg-[#0A0A0C] p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 mb-1">
          <span>Amount to withdraw ({currency})</span>
          <button
            type="button"
            onClick={() => setAmount(String(max))}
            className="text-emerald-400 hover:text-emerald-300 normal-case tracking-normal"
          >
            Max {sym}{max.toLocaleString()}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-400">{sym}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={currency === "NGN" ? 1 : 0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-2xl font-black text-white tabular-nums focus:outline-none"
          />
        </div>
      </div>

      {amt > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>You requested</span>
            <span className="tabular-nums">{sym}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Paystack transfer fee</span>
            <span className="tabular-nums">− {sym}{fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="mt-1 pt-1 border-t border-emerald-500/20 flex items-center justify-between font-bold text-emerald-200">
            <span>Bank receives</span>
            <span className="tabular-nums">{sym}{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={!(amt > 0) || amt > max || busy || net <= 0}
        className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {busy ? "Sending…" : `Send ${sym}${net > 0 ? net.toLocaleString() : "0"} to bank`}
      </button>
      <p className="text-[11px] text-slate-500 text-center">
        {sym}{amt > 0 ? amt.toLocaleString() : "0"} is debited from your wallet. Paystack's fee is deducted before the bank receives.
      </p>
    </ModalShell>
  );
}

function WireForm({
  onClose,
  onBack,
  max,
  onSubmitted,
}: {
  onClose: () => void;
  onBack: () => void;
  max: number;
  onSubmitted: (amount: number, destinationLabel: string) => void;
}) {
  const create = useServerFn(createPayoutRequest);
  const [amount, setAmount] = useState("");
  const [wireBene, setWireBene] = useState("");
  const [wireBank, setWireBank] = useState("");
  const [wireAcct, setWireAcct] = useState("");
  const [wireSwift, setWireSwift] = useState("");
  const [wireRouting, setWireRouting] = useState("");
  const [wireCountry, setWireCountry] = useState("");
  const [wireAddress, setWireAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return;
    if (amt > max) {
      toast.error("Amount exceeds available balance");
      return;
    }
    if (!wireBene || !wireBank || !wireAcct || !wireSwift) {
      toast.error("Fill beneficiary, bank, account and SWIFT");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          currency: "USD",
          method: "wire",
          amount: amt,
          destination: {
            beneficiary_name: wireBene,
            bank_name: wireBank,
            account_number: wireAcct,
            swift: wireSwift,
            routing: wireRouting,
            bank_country: wireCountry,
            beneficiary_address: wireAddress,
          },
        },
      });
      onSubmitted(Number(amount), `${wireBank} · ${wireAcct}`);

    } catch (e) {
      toast.error("Payout failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="USD International Wire · Payout" onClose={onClose}>
      <button type="button" onClick={onBack} className="text-[11px] text-slate-400 hover:text-white uppercase tracking-wider">
        ← Change currency
      </button>
      <div className="rounded-xl border border-[#222226] bg-[#0A0A0C] p-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Amount (USD)</div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-400">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-2xl font-black text-white tabular-nums focus:outline-none"
          />
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Available: ${max.toLocaleString()}</div>
      </div>
      <Field label="Beneficiary name"><TxtInput value={wireBene} onChange={setWireBene} placeholder="Full legal name" /></Field>
      <Field label="Beneficiary address"><TxtInput value={wireAddress} onChange={setWireAddress} placeholder="Street, city, country" /></Field>
      <Field label="Bank name"><TxtInput value={wireBank} onChange={setWireBank} placeholder="e.g. Chase, HSBC" /></Field>
      <Field label="Account number / IBAN"><TxtInput value={wireAcct} onChange={setWireAcct} placeholder="Account or IBAN" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="SWIFT / BIC"><TxtInput value={wireSwift} onChange={setWireSwift} placeholder="ABCDUSXX" /></Field>
        <Field label="Routing / Sort (optional)"><TxtInput value={wireRouting} onChange={setWireRouting} placeholder="If applicable" /></Field>
      </div>
      <Field label="Bank country"><TxtInput value={wireCountry} onChange={setWireCountry} placeholder="e.g. United States" /></Field>
      <button
        onClick={submit}
        disabled={busy}
        className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {busy ? "Submitting…" : `Request $${amount || "0"} wire`}
      </button>
      <p className="text-[11px] text-slate-500 text-center">
        USD wires are processed manually — admin sends via Wise / correspondent bank within 24–48 hours.
      </p>
    </ModalShell>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}

function TxtInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-lg border border-[#222226] bg-[#0A0A0C] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
    />
  );
}
