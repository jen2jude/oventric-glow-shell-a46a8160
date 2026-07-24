import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export interface CashbackUserRow {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarPath: string | null;
  accumulatedUSD: number;
  updatedAt: string;
}

export interface CashbackHistoryRow {
  id: string;
  userId: string;
  displayName: string | null;
  username: string | null;
  amountUSD: number;
  inflow: boolean;
  txHash: string;
  occurredAt: string;
}

export interface CashbackSummaryDTO {
  totalOutstandingUSD: number;
  totalEarnedUSD: number;
  totalSpentUSD: number;
  userCount: number;
}

export const getCashbackSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashbackSummaryDTO> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [wRes, txRes] = await Promise.all([
      supabaseAdmin.from("wallets").select("user_id, accumulated_cashback").gt("accumulated_cashback", 0),
      supabaseAdmin.from("wallet_transactions").select("amount, inflow").eq("type", "Cashback Earned"),
    ]);
    const outstanding = (wRes.data ?? []).reduce((s, r) => s + Number(r.accumulated_cashback ?? 0), 0);
    const users = new Set((wRes.data ?? []).map((r) => r.user_id as string));
    const earned = (txRes.data ?? []).filter((r) => r.inflow).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      totalOutstandingUSD: Number(outstanding.toFixed(2)),
      totalEarnedUSD: Number(earned.toFixed(2)),
      totalSpentUSD: Number(Math.max(0, earned - outstanding).toFixed(2)),
      userCount: users.size,
    };
  });

export const listCashbackUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashbackUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("wallets")
      .select("user_id, accumulated_cashback, updated_at")
      .gt("accumulated_cashback", 0)
      .order("accumulated_cashback", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
    const profiles = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name, username, avatar_path").in("user_id", ids)
      : { data: [] as Array<Record<string, unknown>> };
    const pmap = new Map<string, { display_name: string | null; username: string | null; avatar_path: string | null }>();
    for (const p of (profiles.data ?? []) as Array<Record<string, unknown>>) {
      pmap.set(p.user_id as string, {
        display_name: (p.display_name as string) ?? null,
        username: (p.username as string) ?? null,
        avatar_path: (p.avatar_path as string) ?? null,
      });
    }
    return (data ?? []).map((r) => {
      const p = pmap.get(r.user_id as string);
      return {
        userId: r.user_id as string,
        displayName: p?.display_name ?? null,
        username: p?.username ?? null,
        avatarPath: p?.avatar_path ?? null,
        accumulatedUSD: Number(r.accumulated_cashback ?? 0),
        updatedAt: r.updated_at as string,
      };
    });
  });

export const listCashbackHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashbackHistoryRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id, user_id, amount, inflow, tx_hash, occurred_at")
      .eq("type", "Cashback Earned")
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
    const profiles = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name, username").in("user_id", ids)
      : { data: [] as Array<Record<string, unknown>> };
    const pmap = new Map<string, { display_name: string | null; username: string | null }>();
    for (const p of (profiles.data ?? []) as Array<Record<string, unknown>>) {
      pmap.set(p.user_id as string, {
        display_name: (p.display_name as string) ?? null,
        username: (p.username as string) ?? null,
      });
    }
    return (data ?? []).map((r) => {
      const p = pmap.get(r.user_id as string);
      return {
        id: r.id as string,
        userId: r.user_id as string,
        displayName: p?.display_name ?? null,
        username: p?.username ?? null,
        amountUSD: Number(r.amount ?? 0),
        inflow: Boolean(r.inflow),
        txHash: (r.tx_hash as string) ?? "",
        occurredAt: r.occurred_at as string,
      };
    });
  });
