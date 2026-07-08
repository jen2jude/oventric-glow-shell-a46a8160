import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportStatus = "pending" | "approved" | "hidden";
export type ReportReason = "spam" | "harassment" | "ip" | "scam";

export interface AdminReport {
  id: string;
  target_id: string;
  target_kind: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) {
    console.error("[admin-reports] has_role failed", error);
    throw new Error("Failed to verify admin role");
  }
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listPendingReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["pending", "approved", "hidden", "all"]).default("pending"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("post_reports")
      .select("id, target_id, target_kind, reason, note, status, created_at, resolved_at, resolved_by")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[listPendingReports]", error);
      throw new Error("Failed to load reports");
    }
    return { reports: (rows ?? []) as AdminReport[] };
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        action: z.enum(["approve", "hide", "reset"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const nextStatus: ReportStatus =
      data.action === "approve" ? "approved" : data.action === "hide" ? "hidden" : "pending";
    const { data: row, error } = await context.supabase
      .from("post_reports")
      .update({
        status: nextStatus,
        resolved_at: nextStatus === "pending" ? null : new Date().toISOString(),
        resolved_by: nextStatus === "pending" ? null : context.userId,
      })
      .eq("id", data.reportId)
      .select("id, target_id, target_kind, reason, note, status, created_at, resolved_at, resolved_by")
      .maybeSingle();
    if (error) {
      console.error("[resolveReport]", error);
      throw new Error("Failed to update report");
    }
    if (!row) throw new Error("Report not found");
    return { report: row as AdminReport };
  });
