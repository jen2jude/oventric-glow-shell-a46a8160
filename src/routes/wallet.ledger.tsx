import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Send, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listWalletTransactions,
  type WalletTxType,
  type WalletTxStatus,
} from "@/lib/wallet.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { StatusBadge } from "@/components/oventric/wallet/shared";
import { downloadWalletCsv, printWalletPdf } from "@/components/oventric/wallet/export";
import { TransferModal } from "@/components/oventric/wallet/TransferModal";
import { AddCapitalModal, PayoutModal } from "@/components/oventric/Wallet";
import { formatMoney } from "@/lib/fx-display";
import { CURRENCY_CODES } from "@/lib/currency/africa";

export const Route = createFileRoute("/wallet/ledger")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Wallet Ledger — Oventric" }],
  }),
  component: WalletLedgerPage,
});

const TYPES: ("ALL" | WalletTxType)[] = [
  "ALL",
  "Marketplace Purchase",
  "Marketplace Sale",
  "Gig Bounty Escrowed",
  "Ad Injection Charge",
  "Affiliate Cashback Payout",
  "Wallet Top-Up",
  "Payout Withdrawal",
  "Cashback Earned",
  "Wallet Transfer Sent",
  "Wallet Transfer Received",
];
const STATUSES: ("ALL" | WalletTxStatus)[] = ["ALL", "success", "pending", "failed"];
const PAGE_SIZE = 15;

function WalletLedgerPage() {
  const { baseCurrency } = useOnboarding();
  const [userId, setUserId] = useState<string | null>(null);
  const [type, setType] = useState<"ALL" | WalletTxType>("ALL");
  const [status, setStatus] = useState<"ALL" | WalletTxStatus>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  useEffect(() => setPage(1), [type, status, from, to]);

  const fetchList = useServerFn(listWalletTransactions);
  const query = useQuery({
    queryKey: ["wallet-ledger", userId, type, status, from, to, page],
    enabled: !!userId,
    queryFn: () =>
      fetchList({
        data: {
          type,
          status,
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportAll = async (kind: "csv" | "pdf") => {
    const all = await fetchList({
      data: {
        type,
        status,
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : null,
        page: 1,
        pageSize: 1000,
      },
    });
    if (kind === "csv") downloadWalletCsv(all.items);
    else printWalletPdf(all.items, baseCurrency);
  };

  return (
    <div className="page-light min-h-screen bg-[#0b0b0e] md:bg-slate-50 text-white md:text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="p-2 rounded-[10px] hover:bg-white/10 md:hover:bg-slate-100 text-white/70 md:text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">Wallet Ledger</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTransferOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 text-xs font-semibold"
          >
            <Send className="w-3.5 h-3.5" /> Send to user
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Fund wallet
          </button>
          <button
            onClick={() => setPayoutOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-sky-500/40 bg-sky-500/10 text-sky-300 text-xs font-semibold"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" /> Request payout
          </button>
          <div className="flex-1" />
          <button
            onClick={() => exportAll("csv")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => exportAll("pdf")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 text-xs"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center rounded-xl border border-white/10 md:border-slate-200 bg-white/[0.03] md:bg-white p-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "ALL" | WalletTxType)}
            className="px-2.5 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 bg-transparent text-xs"
          >
            {TYPES.map((t) => (
              <option key={t} value={t} className="text-black">
                {t}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "ALL" | WalletTxStatus)}
            className="px-2.5 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 bg-transparent text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="text-black">
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 bg-transparent text-xs"
          />
          <span className="text-xs text-white/40">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 bg-transparent text-xs"
          />
        </div>

        <div className="rounded-xl border border-white/10 md:border-slate-200 bg-white/[0.03] md:bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 md:text-slate-500 bg-white/[0.02] md:bg-slate-50">
                  <th className="px-4 py-2.5">Tx ID</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Impact</th>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-t border-white/5 md:border-slate-200">
                    <td className="px-4 py-3 font-mono text-[11px] text-white/50 md:text-slate-500 whitespace-nowrap">
                      {t.txHash}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{t.type}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap ${t.inflow ? "text-emerald-400" : ""}`}
                    >
                      {t.inflow ? "+" : "-"}
                      {formatMoney(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50 md:text-slate-500 whitespace-nowrap">
                      {new Date(t.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-white/40 md:text-slate-500"
                    >
                      {query.isLoading ? "Loading…" : "No transactions match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-3 border-t border-white/10 md:border-slate-200 text-xs text-white/50 md:text-slate-500">
            <div>
              Page {page} of {totalPages} · {total} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-[10px] border border-white/15 md:border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {transferOpen && (
        <TransferModal onClose={() => setTransferOpen(false)} onDone={() => query.refetch()} />
      )}
      {addOpen && <AddCapitalModal onClose={() => setAddOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}
