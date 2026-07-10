import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: ReturnType<typeof Object>; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function writeAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  actorId: string,
  action: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  await sb.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_kind: "bounty",
    target_id: targetId,
    meta,
  });
}

export interface BountyInput {
  id?: string;
  title: string;
  description?: string;
  category: string;
  price_usd: number;
  cover_path?: string | null;
  applicant_limit?: number;
  start_at?: string | null;
  end_at?: string | null;
  deadline_at?: string | null;
  status?: "active" | "paused" | "closed" | "draft";
  poster_id?: string | null;
}

/** Admin — list every bounty. */
export const listAllBounties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("bounties")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admin — create a bounty. Poster defaults to the admin unless overridden. */
export const adminCreateBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: BountyInput) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (!data.title?.trim()) throw new Error("Title required");
    if (!(Number(data.price_usd) >= 0)) throw new Error("Price must be >= 0");
    const { data: row, error } = await sb
      .from("bounties")
      .insert({
        poster_id: data.poster_id || context.userId,
        title: data.title.trim(),
        description: data.description ?? "",
        category: data.category || "api",
        price_usd: Number(data.price_usd),
        cover_path: data.cover_path ?? null,
        applicant_limit: data.applicant_limit ?? 10,
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        deadline_at: data.deadline_at ?? null,
        status: data.status ?? "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "bounty.create", row.id as string);
    return { id: row.id as string };
  });

/** Admin — update any bounty (works across all posters via admin RLS). */
export const adminUpdateBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: BountyInput & { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.description !== undefined) patch.description = data.description;
    if (data.category !== undefined) patch.category = data.category;
    if (data.price_usd !== undefined) patch.price_usd = Number(data.price_usd);
    if (data.cover_path !== undefined) patch.cover_path = data.cover_path;
    if (data.applicant_limit !== undefined) patch.applicant_limit = data.applicant_limit;
    if (data.start_at !== undefined) patch.start_at = data.start_at;
    if (data.end_at !== undefined) patch.end_at = data.end_at;
    if (data.deadline_at !== undefined) patch.deadline_at = data.deadline_at;
    if (data.status !== undefined) patch.status = data.status;
    const { error } = await sb.from("bounties").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "bounty.update", data.id, patch);
    return { ok: true };
  });

/** Admin — delete any bounty. */
export const adminDeleteBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("bounties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "bounty.delete", data.id);
    return { ok: true };
  });

export const BOUNTY_SOLVER_SHARE = 0.8;

/** Admin — mark a bounty solved and pay out 80% to the solver, 20% to the admin bounty wallet. */
export const adminPayoutBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; solverId: string }) => ({
    id: String(i?.id ?? ""),
    solverId: String(i?.solverId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.id || !data.solverId) throw new Error("Bounty id and solver id required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: b, error } = await sb
      .from("bounties")
      .select("id, price_usd, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Bounty not found");
    if (b.status === "closed") throw new Error("Bounty already closed");

    const total = Number(b.price_usd);
    const solverCut = Number((total * BOUNTY_SOLVER_SHARE).toFixed(2));
    const platformCut = Number((total - solverCut).toFixed(2));

    // Pay solver via wallet_credit — restricted to service-role callers.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("wallet_credit", { _user_id: data.solverId, _amount: solverCut });

    // Ledger entry for solver.
    await sb.from("wallet_transactions").insert({
      user_id: data.solverId,
      tx_hash: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`,
      type: "Gig Bounty Escrowed",
      amount: solverCut,
      currency: "USD",
      inflow: true,
      status: "success",
      occurred_at: new Date().toISOString(),
    });

    // Credit admin bounty wallet.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("system_wallet_credit", {
      _kind: "bounty",
      _amount: platformCut,
      _source: "bounty_payout",
      _ref: b.id,
      _meta: { bounty_id: b.id, solver_id: data.solverId },
    });

    await sb.from("bounties").update({ status: "closed" }).eq("id", b.id);
    await writeAudit(sb, context.userId, "bounty.payout", b.id, { solverCut, platformCut, solverId: data.solverId });
    return { ok: true, solverCut, platformCut };
  });

