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
  _sb: any,
  actorId: string,
  action: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_kind: "bounty",
    target_id: targetId,
    meta,
  });
}

/** Insert a bounty-related notification. Kind must contain "bounty" so the
 * inbox routes it to the Bounties channel. Link opens the Bounties page. */
async function notifyBounty(
  userId: string,
  kind: string,
  title: string,
  body: string,
  fromUserId?: string | null,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("notifications").insert({
      user_id: userId,
      kind,
      title,
      body,
      link: "/?section=Bounties",
      from_user_id: fromUserId ?? null,
    });
  } catch {
    /* non-fatal */
  }
}

export interface BountyInput {
  id?: string;
  title: string;
  description?: string;
  category: string;
  price_usd: number;
  cover_path?: string | null;
  images?: string[];
  applicant_limit?: number;
  start_at?: string | null;
  end_at?: string | null;
  deadline_at?: string | null;
  status?: "active" | "paused" | "closed" | "draft" | "pending_review" | "rejected" | "solved" | "released" | "disputed";
  poster_id?: string | null;
  promoted?: boolean;
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
        images: Array.isArray(data.images) ? data.images : [],
        applicant_limit: data.applicant_limit ?? 10,
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        deadline_at: data.deadline_at ?? null,
        status: data.status ?? "active",
        promoted: data.promoted === true,
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
    if (data.images !== undefined) patch.images = Array.isArray(data.images) ? data.images : [];
    if (data.applicant_limit !== undefined) patch.applicant_limit = data.applicant_limit;
    if (data.start_at !== undefined) patch.start_at = data.start_at;
    if (data.end_at !== undefined) patch.end_at = data.end_at;
    if (data.deadline_at !== undefined) patch.deadline_at = data.deadline_at;
    if (data.status !== undefined) patch.status = data.status;
    if (data.promoted !== undefined) patch.promoted = data.promoted === true;
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
    await supabaseAdmin.from("wallet_transactions").insert({
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

// ---------------------------------------------------------------------------
// Bounty lifecycle: publish, apply, accept, mark solved, dispute, admin
// ---------------------------------------------------------------------------

/** Poster publishes a bounty (any authenticated user). Locks price_usd into escrow. */
export const publishBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: BountyInput) => i)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (!data.title?.trim()) throw new Error("Title required");
    const price = Number(data.price_usd);
    if (!(price >= 0)) throw new Error("Price must be >= 0");

    const images = Array.isArray(data.images) ? data.images.slice(0, 5) : [];
    const cover = data.cover_path ?? images[0] ?? null;

    const { data: row, error } = await sb
      .from("bounties")
      .insert({
        poster_id: context.userId,
        title: data.title.trim(),
        description: data.description ?? "",
        category: data.category || "api",
        price_usd: price,
        cover_path: cover,
        images,
        applicant_limit: data.applicant_limit ?? 10,
        start_at: data.start_at ?? null,
        end_at: data.end_at ?? null,
        deadline_at: data.deadline_at ?? null,
        status: "active",
        promoted: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (price > 0) {
      const { error: lockErr } = await sb.rpc("bounty_publish_lock", {
        _bounty_id: row.id,
        _amount_usd: price,
      });
      if (lockErr) {
        // Roll back the bounty row if we couldn't lock funds.
        await sb.from("bounties").delete().eq("id", row.id);
        throw new Error(lockErr.message);
      }
    }
    return { id: row.id as string };
  });

/** Any signed-in user applies to a bounty. Also DMs the poster with the pitch. */
export const applyToBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string; pitch?: string }) => ({
    bounty_id: String(i?.bounty_id ?? ""),
    pitch: String(i?.pitch ?? "").slice(0, 2000),
  }))
  .handler(async ({ data, context }) => {
    if (!data.bounty_id) throw new Error("bounty_id required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: b, error: bErr } = await sb
      .from("bounties")
      .select("id, title, poster_id, status")
      .eq("id", data.bounty_id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!b) throw new Error("Bounty not found");
    if (b.poster_id === context.userId) throw new Error("You can't apply to your own bounty");
    if (!["active", "pending_review"].includes(b.status as string)) {
      throw new Error("This bounty is no longer accepting applications");
    }

    const { error } = await sb.from("bounty_applications").insert({
      bounty_id: data.bounty_id,
      applicant_id: context.userId,
      pitch: data.pitch,
    });
    if (error) throw new Error(error.message);

    // Send a DM to the poster containing the pitch. The
    // notify_on_direct_message trigger creates the inbox notification.
    const pitchBody = data.pitch?.trim()
      ? data.pitch.trim()
      : `Hi — I'd like to take on your bounty "${b.title}".`;
    const dmBody = `📌 Bounty application — "${b.title}"\n\n${pitchBody}`;
    await sb.from("direct_messages").insert({
      sender_id: context.userId,
      recipient_id: b.poster_id,
      body: dmBody,
    });

    return { ok: true };
  });


/** Poster accepts an applicant. */
export const acceptApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string; applicant_id: string }) => i)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: b, error: bErr } = await sb
      .from("bounties").select("poster_id, status").eq("id", data.bounty_id).maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!b) throw new Error("Bounty not found");
    if (b.poster_id !== context.userId) throw new Error("Only the poster can accept applicants");

    const { error: e1 } = await sb.from("bounties")
      .update({ accepted_applicant_id: data.applicant_id, status: "active" })
      .eq("id", data.bounty_id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await sb.from("bounty_applications")
      .update({ status: "accepted" })
      .eq("bounty_id", data.bounty_id).eq("applicant_id", data.applicant_id);
    if (e2) throw new Error(e2.message);
    await sb.from("bounty_applications")
      .update({ status: "rejected" })
      .eq("bounty_id", data.bounty_id).neq("applicant_id", data.applicant_id).eq("status", "pending");
    return { ok: true };
  });

/** Accepted solver marks work delivered — starts 48-hour verification window. */
export const markBountySolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string }) => i)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: b, error } = await sb
      .from("bounties").select("accepted_applicant_id, status").eq("id", data.bounty_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Bounty not found");
    if (b.accepted_applicant_id !== context.userId) throw new Error("Only the accepted solver can mark this solved");
    if (b.status === "released" || b.status === "closed") throw new Error("Bounty already settled");
    const { error: e2 } = await sb.from("bounties")
      .update({ solved_at: new Date().toISOString(), status: "solved" })
      .eq("id", data.bounty_id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Poster confirms solved work early — releases funds immediately. */
export const confirmAndRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string }) => i)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: b, error } = await sb
      .from("bounties").select("poster_id, status").eq("id", data.bounty_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Bounty not found");
    if (b.poster_id !== context.userId) throw new Error("Only the poster can confirm");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e2 } = await (supabaseAdmin as unknown as { rpc: (n: string, p: unknown) => Promise<{ error: Error | null }> })
      .rpc("bounty_release_escrow", { _bounty_id: data.bounty_id });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Either poster or solver opens a dispute — auto-release is paused. */
export const openBountyDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { bounty_id: string; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: b, error } = await sb.from("bounties")
      .select("poster_id, accepted_applicant_id").eq("id", data.bounty_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Bounty not found");
    if (![b.poster_id, b.accepted_applicant_id].includes(context.userId))
      throw new Error("Only the poster or accepted solver can open a dispute");
    const { error: e2 } = await sb.from("bounties")
      .update({ dispute_status: "open", status: "disputed", reject_reason: data.reason ?? null })
      .eq("id", data.bounty_id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin — full detail view + moderation
// ---------------------------------------------------------------------------

export const adminBountyDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: bounty, error } = await admin.from("bounties").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!bounty) throw new Error("Bounty not found");

    const { data: apps } = await admin.from("bounty_applications")
      .select("id, applicant_id, pitch, status, created_at").eq("bounty_id", data.id)
      .order("created_at", { ascending: false });

    const ids = Array.from(new Set([
      bounty.poster_id as string,
      bounty.accepted_applicant_id as string | null,
      ...((apps ?? []).map((a: { applicant_id: string }) => a.applicant_id) as string[]),
    ].filter(Boolean))) as string[];

    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("user_id, display_name, username, slug, avatar_path").in("user_id", ids)
      : { data: [] };

    const { data: posterWallet } = await admin.from("wallets")
      .select("available_balance, escrow_balance")
      .eq("user_id", bounty.poster_id).eq("currency", "USD").maybeSingle();

    return {
      bounty,
      applications: apps ?? [],
      profiles: profiles ?? [],
      posterWallet: posterWallet ?? { available_balance: 0, escrow_balance: 0 },
    };
  });

export const adminApproveBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; approve: boolean; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = data.approve
      ? { status: "active", reject_reason: null }
      : { status: "rejected", reject_reason: data.reason ?? "Not approved" };
    const { error } = await sb.from("bounties").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (!data.approve) {
      // Refund escrow when rejecting
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as unknown as { rpc: (n: string, p: unknown) => Promise<{ error: Error | null }> })
        .rpc("bounty_refund_escrow", { _bounty_id: data.id, _reason: data.reason ?? "Rejected by admin" });
    }
    await writeAudit(sb, context.userId, data.approve ? "bounty.approve" : "bounty.reject", data.id, {});
    return { ok: true };
  });

export const adminSetBountyHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; hold: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("bounties").update({ admin_hold: data.hold }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "bounty.hold", data.id, { hold: data.hold });
    return { ok: true };
  });

export const adminReleaseBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as { rpc: (n: string, p: unknown) => Promise<{ error: Error | null }> })
      .rpc("bounty_release_escrow", { _bounty_id: data.id });
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase as unknown as never, context.userId, "bounty.release", data.id, {});
    return { ok: true };
  });

export const adminRefundBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as { rpc: (n: string, p: unknown) => Promise<{ error: Error | null }> })
      .rpc("bounty_refund_escrow", { _bounty_id: data.id, _reason: data.reason ?? "Refunded by admin" });
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase as unknown as never, context.userId, "bounty.refund", data.id, {});
    return { ok: true };
  });

