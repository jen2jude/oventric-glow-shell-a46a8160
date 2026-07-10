import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SystemWalletKind = "marketplace" | "bounty" | "ads";

export interface SystemWalletDTO {
  kind: SystemWalletKind;
  balanceUSD: number;
  updatedAt: string;
}

export interface SystemWalletTxDTO {
  id: string;
  kind: SystemWalletKind;
  amountUSD: number;
  source: string;
  refId: string | null;
  createdAt: string;
  meta: Record<string, unknown>;
}

async function assertAdmin(ctx: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getSystemWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemWalletDTO[]> => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("system_wallets")
      .select("kind, balance_usd, updated_at")
      .order("kind", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      kind: r.kind as SystemWalletKind,
      balanceUSD: Number(r.balance_usd),
      updatedAt: r.updated_at as string,
    }));
  });

export const listSystemWalletTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind?: SystemWalletKind | "ALL"; limit?: number }) => ({
    kind: (i?.kind ?? "ALL") as SystemWalletKind | "ALL",
    limit: Math.min(100, Math.max(1, Number(i?.limit ?? 25))),
  }))
  .handler(async ({ data, context }): Promise<SystemWalletTxDTO[]> => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    let q = sb
      .from("system_wallet_transactions")
      .select("id, kind, amount_usd, source, ref_id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.kind !== "ALL") q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      kind: r.kind as SystemWalletKind,
      amountUSD: Number(r.amount_usd),
      source: r.source as string,
      refId: (r.ref_id as string) ?? null,
      createdAt: r.created_at as string,
      meta: (r.meta as Record<string, unknown>) ?? {},
    }));
  });
