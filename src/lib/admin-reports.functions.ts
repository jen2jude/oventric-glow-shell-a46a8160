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
  target_preview: string | null;
  target_author: string | null;
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

async function attachTargetPreviews(sb: any, reports: any[]): Promise<AdminReport[]> {
  const commentIds = reports
    .filter((r) => r.target_kind === "blog_comment")
    .map((r) => r.target_id);
  let commentMap = new Map<string, { text: string; author_name: string }>();
  if (commentIds.length) {
    const { data } = await sb
      .from("blog_comments")
      .select("id, text, author_name")
      .in("id", commentIds);
    (data ?? []).forEach((c: any) =>
      commentMap.set(c.id, { text: c.text, author_name: c.author_name }),
    );
  }
  return reports.map((r) => {
    let preview: string | null = null;
    let author: string | null = null;
    if (r.target_kind === "blog_comment") {
      const c = commentMap.get(r.target_id);
      if (c) {
        preview = c.text.slice(0, 320);
        author = c.author_name;
      }
    }
    return { ...r, target_preview: preview, target_author: author } as AdminReport;
  });
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
    const enriched = await attachTargetPreviews(context.supabase, rows ?? []);
    return { reports: enriched };
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

    // Apply moderation side-effect for blog comments.
    if (row.target_kind === "blog_comment") {
      if (data.action === "hide") {
        await context.supabase
          .from("blog_comments")
          .update({ is_hidden: true })
          .eq("id", row.target_id);
      } else if (data.action === "reset" || data.action === "approve") {
        await context.supabase
          .from("blog_comments")
          .update({ is_hidden: false })
          .eq("id", row.target_id);
      }
    }

    const [enriched] = await attachTargetPreviews(context.supabase, [row]);
    return { report: enriched };
  });
