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
