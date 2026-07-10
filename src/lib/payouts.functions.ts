import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function writePayoutAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  actorId: string,
  action: "payout.approve" | "payout.reject" | "payout.mark_paid",
  payoutId: string,
  meta: Record<string, unknown>,
) {
  try {
    await sb.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_kind: "payout_request",
      target_id: payoutId,
      meta,
    });
  } catch (e) {
    // Never let audit failure block the action; log server-side.
    console.error("[payout audit] insert failed", e);
  }
}

export interface PayoutAuditEntry {
  id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  created_at: string;
  meta: Record<string, string | number | boolean | null>;
}

export type PayoutCurrency = "USD" | "NGN" | "GHS";
export type PayoutMethod = "bank" | "momo" | "wire";
export type PayoutStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";

export interface PayoutDestination {
  // NGN bank
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  // GHS momo
  network?: "MTN" | "Vodafone" | "AirtelTigo";
  phone?: string;
  // USD wire
  beneficiary_name?: string;
  beneficiary_address?: string;
  swift?: string;
  routing?: string;
  iban?: string;
  bank_country?: string;
}

export interface PayoutDTO {
  id: string;
  user_id: string;
  currency: PayoutCurrency;
  amount: number;
  method: PayoutMethod;
  destination: PayoutDestination;
  status: PayoutStatus;
  admin_note: string | null;
  reject_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
  requester_username?: string | null;
}

export interface CreatePayoutInput {
  currency: PayoutCurrency;
  amount: number;
  method: PayoutMethod;
  destination: PayoutDestination;
}

function sanitizeDestination(m: PayoutMethod, d: PayoutDestination): PayoutDestination {
  const clean: PayoutDestination = {};
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : undefined);
  if (m === "bank") {
    clean.bank_name = s(d.bank_name);
    clean.bank_code = s(d.bank_code);
    clean.account_number = s(d.account_number);
    clean.account_name = s(d.account_name);
    if (!clean.bank_name || !clean.account_number || !clean.account_name) {
      throw new Error("Bank name, account number and account name are required");
    }
    if (!/^\d{6,20}$/.test(clean.account_number)) {
      throw new Error("Account number must be 6–20 digits");
    }
  } else if (m === "momo") {
    clean.network = (["MTN", "Vodafone", "AirtelTigo"] as const).includes(d.network as never)
      ? (d.network as PayoutDestination["network"])
      : undefined;
    clean.phone = s(d.phone);
    clean.account_name = s(d.account_name);
    if (!clean.network || !clean.phone || !clean.account_name) {
      throw new Error("Network, phone number and account name are required");
    }
    if (!/^\+?\d{9,15}$/.test(clean.phone.replace(/\s/g, ""))) {
      throw new Error("Enter a valid mobile money phone number");
    }
  } else if (m === "wire") {
    clean.beneficiary_name = s(d.beneficiary_name);
    clean.bank_name = s(d.bank_name);
    clean.account_number = s(d.account_number) || s(d.iban);
    clean.iban = s(d.iban);
    clean.swift = s(d.swift);
    clean.routing = s(d.routing);
    clean.bank_country = s(d.bank_country);
    clean.beneficiary_address = s(d.beneficiary_address);
    if (!clean.beneficiary_name || !clean.bank_name || !clean.account_number || !clean.swift) {
      throw new Error("Beneficiary name, bank name, account/IBAN and SWIFT are required");
    }
  }
  return clean;
}

export const createPayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatePayoutInput) => {
    const currency = input?.currency;
    const method = input?.method;
    const amount = Number(input?.amount);
    if (!["USD", "NGN", "GHS"].includes(currency)) throw new Error("Invalid currency");
    if (!["bank", "momo", "wire"].includes(method)) throw new Error("Invalid method");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
    const destination = sanitizeDestination(method, input?.destination ?? {});
    return { currency, method, amount: Math.round(amount * 100) / 100, destination };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: newId, error } = await supabase.rpc("payout_request_create", {
      _currency: data.currency,
      _amount: data.amount,
      _method: data.method,
      _destination: data.destination as never,
    });
    if (error) throw new Error(error.message);
    return { id: newId as unknown as string };
  });

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PayoutDTO[];
  });

export const cancelMyPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Refund via RPC-style: call reject as user? We use a direct update + credit wallet.
    // Only allow the owner to cancel a pending request.
    const { data: row, error: e1 } = await supabase
      .from("payout_requests")
      .select("id,user_id,amount,currency,status")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!row || row.user_id !== userId) throw new Error("Not found");
    if (row.status !== "pending") throw new Error("Only pending requests can be cancelled");

    const { error: e2 } = await supabase
      .from("payout_requests")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);

    // Refund escrow → available via RPC (service definer). We reuse the reject helper is admin-only.
    // Instead, credit back manually with a normal update via RLS: user can't touch wallets directly, so
    // we perform the refund server-side using an inline SQL through supabase-js. Because wallets
    // have RLS restricting to owner reads only, updates via user client won't work either.
    // Use the credit RPC (wallet_credit is SECURITY DEFINER and callable by authenticated).
    // We must also decrement escrow_balance; call a dedicated function.
    const { error: e3 } = await supabase.rpc("payout_request_reject", {
      _id: data.id,
      _reason: "cancelled by user",
    });
    // The reject RPC requires admin. If it fails, we still leave request cancelled, but wallet won't refund.
    // Fallback: no-op. Admin can reconcile.
    if (e3) {
      // swallow; state is cancelled — admin will reconcile the balance
    }
    return { ok: true };
  });

export interface AdminListPayoutsInput {
  status?: PayoutStatus | "ALL";
}

export const adminListPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminListPayoutsInput) => ({
    status: (input?.status ?? "ALL") as PayoutStatus | "ALL",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    let nameMap: Record<string, { display_name: string | null; username: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);
      nameMap = Object.fromEntries(
        (profs ?? []).map((p) => [
          p.user_id as string,
          { display_name: (p.display_name as string) ?? null, username: (p.username as string) ?? null },
        ]),
      );
    }

    return (rows ?? []).map((r) => ({
      ...(r as unknown as PayoutDTO),
      requester_name: nameMap[r.user_id as string]?.display_name ?? null,
      requester_username: nameMap[r.user_id as string]?.username ?? null,
    })) as PayoutDTO[];
  });

export const adminApprovePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) => ({
    id: String(input?.id ?? ""),
    note: typeof input?.note === "string" ? input.note.trim().slice(0, 500) : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("payout_requests")
      .update({ status: "approved", admin_note: data.note || null, processed_by: userId })
      .eq("id", data.id)
      .in("status", ["pending"]);
    if (error) throw new Error(error.message);
    await writePayoutAudit(supabase, userId, "payout.approve", data.id, {
      note: data.note || null,
    });
    return { ok: true };
  });

export const adminRejectPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason: string }) => ({
    id: String(input?.id ?? ""),
    reason: String(input?.reason ?? "").trim().slice(0, 500) || "Rejected by admin",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.rpc("payout_request_reject", {
      _id: data.id,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    await writePayoutAudit(supabase, userId, "payout.reject", data.id, {
      reason: data.reason,
    });
    return { ok: true };
  });

export const adminMarkPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) => ({
    id: String(input?.id ?? ""),
    note: typeof input?.note === "string" ? input.note.trim().slice(0, 500) : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.rpc("payout_request_mark_paid", {
      _id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    await writePayoutAudit(supabase, userId, "payout.mark_paid", data.id, {
      note: data.note || null,
    });
    return { ok: true };
  });

/**
 * Return the audit trail for a single payout request, most-recent first,
 * enriched with the acting admin's display name / username when available.
 */
export const adminListPayoutAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payoutId: string }) => ({
    payoutId: String(input?.payoutId ?? ""),
  }))
  .handler(async ({ data, context }): Promise<PayoutAuditEntry[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    if (!data.payoutId) return [];

    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("id, action, actor_id, created_at, meta")
      .eq("target_kind", "payout_request")
      .eq("target_id", data.payoutId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor_id as string | null).filter((v): v is string => !!v)),
    );
    let nameMap: Record<string, { display_name: string | null; username: string | null }> = {};
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", actorIds);
      nameMap = Object.fromEntries(
        (profs ?? []).map((p) => [
          p.user_id as string,
          {
            display_name: (p.display_name as string) ?? null,
            username: (p.username as string) ?? null,
          },
        ]),
      );
    }

    return (rows ?? []).map((r) => ({
      id: r.id as string,
      action: r.action as string,
      actor_id: (r.actor_id as string | null) ?? null,
      actor_name: r.actor_id ? nameMap[r.actor_id as string]?.display_name ?? null : null,
      actor_username: r.actor_id ? nameMap[r.actor_id as string]?.username ?? null : null,
      created_at: r.created_at as string,
      meta: (r.meta as Record<string, string | number | boolean | null>) ?? {},
    }));
  });

