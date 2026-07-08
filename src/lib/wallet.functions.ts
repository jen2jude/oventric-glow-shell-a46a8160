import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WalletCurrency = "USD" | "NGN" | "GHS";
export type WalletTxStatus = "success" | "pending" | "failed";
export type WalletTxType =
  | "Marketplace Purchase"
  | "Gig Bounty Escrowed"
  | "Ad Injection Charge"
  | "Affiliate Cashback Payout"
  | "Wallet Top-Up"
  | "Payout Withdrawal";

export interface WalletTxDTO {
  id: string;
  txHash: string;
  type: WalletTxType;
  amount: number;
  currency: WalletCurrency;
  inflow: boolean;
  status: WalletTxStatus;
  occurredAt: string;
}

export interface ListWalletTxInput {
  search?: string;
  currency?: "ALL" | WalletCurrency;
  page?: number;
  pageSize?: number;
}

export interface ListWalletTxResult {
  items: WalletTxDTO[];
  total: number;
  page: number;
  pageSize: number;
}

const SEED_TEMPLATES: Array<Omit<WalletTxDTO, "id" | "occurredAt">> = [
  { txHash: "0xA1F9-4402-BC12", type: "Affiliate Cashback Payout", amount: 45000, currency: "NGN", inflow: true, status: "success" },
  { txHash: "0x77E1-9022-D3AA", type: "Gig Bounty Escrowed", amount: 320, currency: "USD", inflow: false, status: "pending" },
  { txHash: "0x3B02-CC81-1FE0", type: "Marketplace Purchase", amount: 120, currency: "USD", inflow: false, status: "success" },
  { txHash: "0xF19D-8801-A44C", type: "Wallet Top-Up", amount: 1500, currency: "USD", inflow: true, status: "success" },
  { txHash: "0x66C4-72B0-9911", type: "Ad Injection Charge", amount: 85, currency: "GHS", inflow: false, status: "failed" },
  { txHash: "0x2E8B-5501-CD33", type: "Payout Withdrawal", amount: 750, currency: "USD", inflow: false, status: "pending" },
  { txHash: "0x91AA-3300-77B4", type: "Affiliate Cashback Payout", amount: 62, currency: "GHS", inflow: true, status: "success" },
  { txHash: "0x0D53-6621-88EE", type: "Marketplace Purchase", amount: 240000, currency: "NGN", inflow: false, status: "success" },
  { txHash: "0x4471-9C02-BF10", type: "Gig Bounty Escrowed", amount: 900, currency: "USD", inflow: true, status: "pending" },
  { txHash: "0x5A2C-0091-EF77", type: "Wallet Top-Up", amount: 220, currency: "GHS", inflow: true, status: "success" },
];

export const listWalletTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ListWalletTxInput) => ({
    search: typeof input?.search === "string" ? input.search.trim() : "",
    currency: (input?.currency ?? "ALL") as "ALL" | WalletCurrency,
    page: Math.max(1, Number(input?.page ?? 1)),
    pageSize: Math.min(50, Math.max(1, Number(input?.pageSize ?? 6))),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Auto-seed the current user's ledger on first read.
    const { count: existing } = await supabase
      .from("wallet_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((existing ?? 0) === 0) {
      const now = Date.now();
      const rows = SEED_TEMPLATES.map((t, i) => ({
        user_id: userId,
        tx_hash: t.txHash,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        inflow: t.inflow,
        status: t.status,
        occurred_at: new Date(now - i * 1000 * 60 * 60 * 6).toISOString(),
      }));
      await supabase.from("wallet_transactions").insert(rows);
    }

    let q = supabase
      .from("wallet_transactions")
      .select("id, tx_hash, type, amount, currency, inflow, status, occurred_at", { count: "exact" })
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false });

    if (data.currency !== "ALL") q = q.eq("currency", data.currency);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(`tx_hash.ilike.%${s}%,type.ilike.%${s}%`);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);

    const items: WalletTxDTO[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      txHash: r.tx_hash as string,
      type: r.type as WalletTxType,
      amount: Number(r.amount),
      currency: r.currency as WalletCurrency,
      inflow: r.inflow as boolean,
      status: r.status as WalletTxStatus,
      occurredAt: r.occurred_at as string,
    }));

    return {
      items,
      total: count ?? items.length,
      page: data.page,
      pageSize: data.pageSize,
    } satisfies ListWalletTxResult;
  });
