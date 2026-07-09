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
import { listWalletTransactions } from "@/lib/wallet.functions";
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

export function Wallet() {
  const { balances, balancesHidden: hide, toggleBalancesHidden, require } = useOnboarding();
  const { ensureKyc, verifyLiveness } = useKycGate();
  const [addOpen, setAddOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [curFilter, setCurFilter] = useState<"ALL" | Currency>("ALL");
  const [page, setPage] = useState(1);
  const [spend, setSpend] = useState(2500);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const cashback = 218.42;

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
    return () => {
      supabase.removeChannel(channel);
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

      {/* 1. Currency Vault Grid */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(currencyMeta) as Currency[]).map((c) => {
            const m = currencyMeta[c];
            return (
              <div
                key={c}
                className={`relative overflow-hidden rounded-2xl border border-[#222226] bg-[#141418] p-5 ${m.glow}`}
              >
                <div className={`absolute inset-x-0 top-0 h-[2px] ${m.dot}/50`} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border ${m.ring} bg-black/40 flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {m.symbol}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{c}</div>
                      <div className="text-[11px] text-slate-500 truncate">{m.label}</div>
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${m.dot} animate-pulse`} />
                </div>
                <div className={`text-2xl sm:text-3xl font-black tabular-nums ${m.text} ${hide ? "blur-sm select-none" : ""}`}>
                  {hide ? mask : fmt(balances[c], c)}
                </div>
                <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wider">
                  Available balance
                </div>
              </div>
            );
          })}
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
          onClick={() => require(1, () => ensureKyc(() => setAddOpen(true)), "funding")}
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
          onClick={() => require(1, () => verifyLiveness(() => setPayoutOpen(true)), "withdraw")}
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
      {addOpen && <AddCapitalModal onClose={() => setAddOpen(false)} />}
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

function AddCapitalModal({ onClose }: { onClose: () => void }) {
  const [pick, setPick] = useState<"card" | "bank" | "momo">("card");
  const options = [
    { id: "card" as const, icon: CreditCard, title: "Card Processing Node", sub: "Global USD · Visa / Mastercard rails" },
    { id: "bank" as const, icon: Building2, title: "Direct Bank Ingestion Node", sub: "NGN via local bank APIs" },
    { id: "momo" as const, icon: Smartphone, title: "Mobile Money Fast-Track", sub: "GHS via MTN / Vodafone rails" },
  ];
  return (
    <ModalShell title="Add Liquid Capital" onClose={onClose}>
      <p className="text-xs text-slate-400">Select a localized payment channel to route incoming funds.</p>
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
      <button className="w-full mt-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 text-sm transition-colors">
        Continue with {pick === "card" ? "Card" : pick === "bank" ? "Bank Transfer" : "Mobile Money"}
      </button>
    </ModalShell>
  );
}

function PayoutModal({ onClose }: { onClose: () => void }) {
  const rails = [
    { c: "NGN", label: "NGN Instant Bank Transfer", eta: "< 5 mins", tone: "emerald" },
    { c: "GHS", label: "GHS MoMo Payout", eta: "< 15 mins", tone: "amber" },
    { c: "USD", label: "USD Wire Transfer", eta: "24–48 Hours", tone: "sky" },
  ];
  return (
    <ModalShell title="Request Payout" onClose={onClose}>
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-200/90">
          Escrow extraction gate · funds are validated against pending obligations before release.
        </p>
      </div>
      <div className="space-y-2">
        {rails.map((r) => (
          <div key={r.c} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#222226] bg-[#0A0A0C] p-3">
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
              r.tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : r.tone === "amber" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300"
            }`}>
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm truncate">{r.label}</div>
              <div className="text-xs text-slate-400">Clearing window</div>
            </div>
            <span className="shrink-0 text-xs font-bold text-slate-200 tabular-nums">{r.eta}</span>
          </div>
        ))}
      </div>
      <button className="w-full mt-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 text-sm transition-colors">
        Continue to security verification
      </button>
    </ModalShell>
  );
}
