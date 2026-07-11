import { useEffect, useMemo, useState } from "react";
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
import { listWalletTransactions, getWalletBalances } from "@/lib/wallet.functions";
import { initPaystackPayment } from "@/lib/paystack.functions";
import { useKycGate } from "@/lib/kyc-gate/KycGate";

type TxStatus = "success" | "pending" | "failed";
type TxType =
  | "Marketplace Purchase"
  | "Gig Bounty Escrowed"
  | "Ad Injection Charge"
  | "Affiliate Cashback Payout"
  | "Wallet Top-Up"
  | "Payout Withdrawal";

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
  const [payoutOpen, setPayoutOpen] = useState(false);
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
      const detail = (e as CustomEvent<{ amountUsd?: number }>).detail;
      const amt = Number(detail?.amountUsd ?? 0);
      if (amt > 0) setAddPrefillUsd(amt);
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
        () => queryClient.invalidateQueries({ queryKey: ["wallet-balances", userId] }),
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
    <div className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 bg-[#0A0A0C] min-h-full">
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

        {/* Cashback accumulator */}
        <div className="relative overflow-hidden rounded-2xl border border-[#222226] bg-[#141418] p-5">
          <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
            <div className="w-11 h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-semibold">
                Internal Cashback Accumulator
              </div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                2%–5% active engine · marketplace bonus capital ready to deploy
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black tabular-nums text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] ${hide ? "blur-sm select-none" : ""}`}>
              {hide ? mask : `$${cashback.toFixed(2)}`}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Ingestion & Extraction */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => require(2, () => ensureKyc(() => setAddOpen(true)), "funding")}
          className="group relative overflow-hidden rounded-2xl border border-[#222226] bg-[#141418] p-5 text-left hover:border-emerald-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0">
              <ArrowDownToLine className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white">➕ Add Liquid Capital</div>
              <div className="text-xs text-slate-400 mt-0.5">Card · Bank · Mobile Money</div>
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
              <div className="text-xs text-slate-400 mt-0.5">Escrow extraction · clearing gate</div>
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

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Projected Monthly Spend / Gig Volume</span>
            <span className="tabular-nums text-slate-200 font-semibold">
              ${spend.toLocaleString("en-US")}{spend >= 10000 ? "+" : ""}
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
            <TierPill active={tier.label === "Baseline"} label="Baseline" desc="< $1K · 2%" />
            <TierPill active={tier.label === "Elite Tier"} label="Elite Tier" desc="$1K–$5K · 3.5%" />
            <TierPill active={tier.label === "Apex Architect"} label="Apex" desc="> $5K · 5%" />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-semibold">
            Estimated Annual Processing Savings
          </div>
          <div className="mt-2 text-3xl sm:text-4xl font-black tabular-nums text-emerald-300 drop-shadow-[0_0_16px_rgba(52,211,153,0.7)]">
            ${annualSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            at <span className="text-emerald-300 font-semibold">{tier.pct}%</span> {tier.label} multiplier
          </div>
        </div>
      </section>

      {/* Modals */}
      {addOpen && (
        <AddCapitalModal
          prefillUsd={addPrefillUsd}
          onClose={() => {
            setAddOpen(false);
            setAddPrefillUsd(null);
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
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-[#141418] border border-[#222226] rounded-t-2xl sm:rounded-2xl shadow-2xl slide-up max-h-[90vh] overflow-y-auto"
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

function AddCapitalModal({ onClose, prefillUsd }: { onClose: () => void; prefillUsd?: number | null }) {
  const { baseCurrency } = useOnboarding();
  const [pick, setPick] = useState<"card" | "bank" | "momo">("card");
  const [amount, setAmount] = useState<string>(
    prefillUsd && prefillUsd > 0 ? prefillUsd.toFixed(2) : "",
  );
  const [busy, setBusy] = useState(false);
  const initPaystack = useServerFn(initPaystackPayment);
  const options = [
    { id: "card" as const, icon: CreditCard, title: "Card Processing Node", sub: "Visa / Mastercard / Verve · secured by Paystack" },
    { id: "bank" as const, icon: Building2, title: "Direct Bank Transfer", sub: "NIP · dynamic virtual account · secured by Paystack" },
    { id: "momo" as const, icon: Smartphone, title: "Mobile Money", sub: "MTN · Vodafone · AirtelTigo (Ghana)" },
  ];
  const hasPrefill = !!(prefillUsd && prefillUsd > 0);
  const fund = async () => {
    const usd = Number(amount);
    if (!(usd > 0)) return;
    setBusy(true);
    try {
      // Charge amount in user's locked base currency (Paystack supports NGN/GHS/USD).
      const FX: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };
      const chargeAmount = Number((usd * FX[baseCurrency]).toFixed(2));
      const channel = pick === "card" ? "card" : pick === "bank" ? "bank_transfer" : "mobile_money";
      const init = await initPaystack({
        data: { purpose: "wallet_topup", amount: chargeAmount, currency: baseCurrency, channel },
      });
      window.location.href = init.authorizationUrl;
    } catch (e) {
      toast.error("Could not start payment", { description: e instanceof Error ? e.message : "Try again." });
      setBusy(false);
    }
  };
  return (
    <ModalShell title="Add Liquid Capital" onClose={onClose}>
      {hasPrefill && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/90 font-semibold">
            Suggested top-up · bounty escrow
          </div>
          <div className="mt-1 text-xs text-slate-300 leading-relaxed">
            Your saved bounty draft needs{" "}
            <span className="text-emerald-300 font-bold">${(prefillUsd ?? 0).toFixed(2)} USD</span>{" "}
            to publish. We&apos;ve prefilled the amount below — adjust it if you want a bigger buffer.
          </div>
        </div>
      )}

      <div>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          Amount (USD)
        </label>
        <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-xl border border-[#222226] bg-[#0A0A0C] focus-within:border-emerald-500/60 transition-colors">
          <span className="px-3 text-slate-400 text-sm">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent py-2.5 pr-3 text-sm text-white placeholder:text-slate-600 outline-none tabular-nums"
          />
        </div>
        {baseCurrency !== "USD" && Number(amount) > 0 && (
          <div className="mt-1 text-[11px] text-slate-500">
            You&apos;ll be charged approximately{" "}
            <span className="text-slate-300 font-semibold">
              {baseCurrency === "NGN" ? "₦" : "₵"}
              {Math.round(Number(amount) * (baseCurrency === "NGN" ? 1500 : 14)).toLocaleString()}
            </span>{" "}
            via Paystack.
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
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? "border-emerald-400 bg-emerald-400" : "border-white/30"}`} />
            </button>
          );
        })}
      </div>
      <button
        onClick={fund}
        disabled={!Number(amount) || Number(amount) <= 0 || busy}
        className="w-full mt-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-slate-500 disabled:cursor-not-allowed text-black font-bold py-2.5 text-sm transition-colors inline-flex items-center justify-center gap-2"
      >
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Paystack…</> : <>Continue with {pick === "card" ? "Card" : pick === "bank" ? "Bank Transfer" : "Mobile Money"}{Number(amount) > 0 ? ` · $${Number(amount).toFixed(2)}` : ""}</>}
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

function PayoutModal({ onClose }: { onClose: () => void }) {
  const { balances } = useOnboarding();
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [rail, setRail] = useState<Rail | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // NGN bank fields
  const [ngBank, setNgBank] = useState("");
  const [ngAcct, setNgAcct] = useState("");
  const [ngName, setNgName] = useState("");

  // GHS momo / bank
  const [ghMode, setGhMode] = useState<"momo" | "bank">("momo");
  const [ghNetwork, setGhNetwork] = useState<"MTN" | "Vodafone" | "AirtelTigo">("MTN");
  const [ghPhone, setGhPhone] = useState("");
  const [ghHolder, setGhHolder] = useState("");
  const [ghBank, setGhBank] = useState("");
  const [ghAcct, setGhAcct] = useState("");

  // USD wire
  const [wireBene, setWireBene] = useState("");
  const [wireBank, setWireBank] = useState("");
  const [wireAcct, setWireAcct] = useState("");
  const [wireSwift, setWireSwift] = useState("");
  const [wireRouting, setWireRouting] = useState("");
  const [wireCountry, setWireCountry] = useState("");
  const [wireAddress, setWireAddress] = useState("");

  const rails: Rail[] = [
    { c: "NGN", method: "bank", label: "NGN Instant Bank Transfer", eta: "< 5 mins", tone: "emerald", hint: "Nigerian bank · NIP rails" },
    { c: "GHS", method: "momo", label: "GHS Mobile Money / Bank", eta: "< 15 mins", tone: "amber", hint: "MTN · Vodafone · AirtelTigo · GH bank" },
    { c: "USD", method: "wire", label: "USD International Wire", eta: "24–48 hours", tone: "sky", hint: "SWIFT · Correspondent bank" },
  ];

  const submit = async () => {
    if (!rail) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const bal = balances[rail.c] ?? 0;
    if (amt > bal) {
      toast.error(`Amount exceeds available balance (${currencyMeta[rail.c].symbol}${bal.toLocaleString()})`);
      return;
    }

    let method: "bank" | "momo" | "wire" = rail.method;
    const destination: Record<string, string> = {};

    try {
      if (rail.c === "NGN") {
        method = "bank";
        if (!ngBank || !ngAcct || !ngName) throw new Error("Fill bank, account number and account name");
        if (!/^\d{10}$/.test(ngAcct)) throw new Error("Nigerian account number must be 10 digits");
        Object.assign(destination, { bank_name: ngBank, account_number: ngAcct, account_name: ngName });
      } else if (rail.c === "GHS") {
        if (ghMode === "momo") {
          method = "momo";
          if (!ghPhone || !ghHolder) throw new Error("Fill mobile number and account name");
          Object.assign(destination, { network: ghNetwork, phone: ghPhone, account_name: ghHolder });
        } else {
          method = "bank";
          if (!ghBank || !ghAcct || !ghHolder) throw new Error("Fill bank, account number and account name");
          Object.assign(destination, { bank_name: ghBank, account_number: ghAcct, account_name: ghHolder });
        }
      } else {
        method = "wire";
        if (!wireBene || !wireBank || !wireAcct || !wireSwift) throw new Error("Fill beneficiary, bank, account and SWIFT");
        Object.assign(destination, {
          beneficiary_name: wireBene,
          bank_name: wireBank,
          account_number: wireAcct,
          swift: wireSwift,
          routing: wireRouting,
          bank_country: wireCountry,
          beneficiary_address: wireAddress,
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    try {
      setSubmitting(true);
      const { createPayoutRequest } = await import("@/lib/payouts.functions");
      // useServerFn is component-scope; call directly is fine for one-off submission.
      await createPayoutRequest({
        data: { currency: rail.c, method, amount: amt, destination },
      });
      toast.success("Payout requested", {
        description: "Your withdrawal is queued for admin review. Funds are held in escrow.",
      });
      onClose();
    } catch (e) {
      toast.error("Payout failed", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "pick") {
    return (
      <ModalShell title="Request Payout" onClose={onClose}>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-200/90">
            Liveness verified. Choose a payout rail — funds move to escrow and clear once an admin approves.
          </p>
        </div>
        <div className="space-y-2">
          {rails.map((r) => {
            const active = rail?.c === r.c;
            const bal = balances[r.c] ?? 0;
            const disabled = bal <= 0;
            return (
              <button
                key={r.c}
                type="button"
                disabled={disabled}
                onClick={() => setRail(r)}
                className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? "border-sky-500/60 bg-sky-500/5"
                    : disabled
                      ? "border-[#1a1a1e] bg-[#0A0A0C] opacity-50 cursor-not-allowed"
                      : "border-[#222226] bg-[#0A0A0C] hover:border-white/20"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                    r.tone === "emerald"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : r.tone === "amber"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : "border-sky-500/40 bg-sky-500/10 text-sky-300"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{r.label}</div>
                  <div className="text-xs text-slate-400 truncate">{r.hint} · {r.eta}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Available</div>
                  <div className="text-xs font-bold text-slate-200 tabular-nums">
                    {currencyMeta[r.c].symbol}
                    {bal.toLocaleString("en-US", { minimumFractionDigits: r.c === "NGN" ? 0 : 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          disabled={!rail}
          onClick={() => setStep("form")}
          className="w-full mt-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to payout details
        </button>
      </ModalShell>
    );
  }

  if (!rail) return null;
  const bal = balances[rail.c] ?? 0;
  const sym = currencyMeta[rail.c].symbol;

  return (
    <ModalShell title={`${rail.label} · Payout Details`} onClose={onClose}>
      <button
        type="button"
        onClick={() => setStep("pick")}
        className="text-[11px] text-slate-400 hover:text-white uppercase tracking-wider"
      >
        ← Change rail
      </button>

      <div className="rounded-xl border border-[#222226] bg-[#0A0A0C] p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 mb-1">
          <span>Amount to withdraw ({rail.c})</span>
          <button
            type="button"
            onClick={() => setAmount(String(bal))}
            className="text-emerald-400 hover:text-emerald-300 normal-case tracking-normal"
          >
            Max {sym}{bal.toLocaleString()}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-400">{sym}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={rail.c === "NGN" ? 1 : 0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-2xl font-black text-white tabular-nums focus:outline-none"
          />
        </div>
      </div>

      {rail.c === "NGN" && (
        <div className="space-y-2">
          <Field label="Bank">
            <select
              value={ngBank}
              onChange={(e) => setNgBank(e.target.value)}
              className="w-full rounded-lg border border-[#222226] bg-[#0A0A0C] px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Select bank…</option>
              {NG_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Account number (10 digits, NUBAN)">
            <TxtInput value={ngAcct} onChange={setNgAcct} placeholder="0123456789" maxLength={10} />
          </Field>
          <Field label="Account name">
            <TxtInput value={ngName} onChange={setNgName} placeholder="As it appears on your bank record" />
          </Field>
        </div>
      )}

      {rail.c === "GHS" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGhMode("momo")}
              className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                ghMode === "momo" ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-[#222226] bg-[#0A0A0C] text-slate-400"
              }`}
            >
              Mobile Money
            </button>
            <button
              type="button"
              onClick={() => setGhMode("bank")}
              className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                ghMode === "bank" ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-[#222226] bg-[#0A0A0C] text-slate-400"
              }`}
            >
              Bank Transfer
            </button>
          </div>

          {ghMode === "momo" ? (
            <>
              <Field label="Network">
                <select
                  value={ghNetwork}
                  onChange={(e) => setGhNetwork(e.target.value as never)}
                  className="w-full rounded-lg border border-[#222226] bg-[#0A0A0C] px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="MTN">MTN Mobile Money</option>
                  <option value="Vodafone">Vodafone Cash</option>
                  <option value="AirtelTigo">AirtelTigo Money</option>
                </select>
              </Field>
              <Field label="Mobile number">
                <TxtInput value={ghPhone} onChange={setGhPhone} placeholder="+233 20 000 0000" />
              </Field>
              <Field label="Registered wallet name">
                <TxtInput value={ghHolder} onChange={setGhHolder} placeholder="Full name on the mobile wallet" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Bank">
                <select
                  value={ghBank}
                  onChange={(e) => setGhBank(e.target.value)}
                  className="w-full rounded-lg border border-[#222226] bg-[#0A0A0C] px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Select bank…</option>
                  {GH_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Account number">
                <TxtInput value={ghAcct} onChange={setGhAcct} placeholder="Bank account number" />
              </Field>
              <Field label="Account name">
                <TxtInput value={ghHolder} onChange={setGhHolder} placeholder="Full account holder name" />
              </Field>
            </>
          )}
        </div>
      )}

      {rail.c === "USD" && (
        <div className="space-y-2">
          <Field label="Beneficiary name"><TxtInput value={wireBene} onChange={setWireBene} placeholder="Full legal name" /></Field>
          <Field label="Beneficiary address"><TxtInput value={wireAddress} onChange={setWireAddress} placeholder="Street, city, country" /></Field>
          <Field label="Bank name"><TxtInput value={wireBank} onChange={setWireBank} placeholder="e.g. Chase, HSBC" /></Field>
          <Field label="Account number / IBAN"><TxtInput value={wireAcct} onChange={setWireAcct} placeholder="Account or IBAN" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="SWIFT / BIC"><TxtInput value={wireSwift} onChange={setWireSwift} placeholder="ABCDUSXX" /></Field>
            <Field label="Routing / Sort (optional)"><TxtInput value={wireRouting} onChange={setWireRouting} placeholder="If applicable" /></Field>
          </div>
          <Field label="Bank country"><TxtInput value={wireCountry} onChange={setWireCountry} placeholder="e.g. United States" /></Field>
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 text-sm transition-colors disabled:opacity-60"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? "Submitting…" : `Request ${sym}${amount || "0"} payout`}
      </button>
      <p className="text-[11px] text-slate-500 text-center">
        Funds are held in escrow until an admin reviews and marks the request paid.
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
