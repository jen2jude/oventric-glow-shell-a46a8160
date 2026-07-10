import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReportInput = z.object({
  targetId: z.string().trim().min(1).max(120),
  targetKind: z.string().trim().min(1).max(40).default("post"),
  reason: z.enum(["spam", "harassment", "ip", "scam"]),
  note: z.string().trim().max(280).optional().nullable(),
});

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data, context }) => {
    // Insert scoped to the authenticated reporter — the row's `reporter_id` is
    // set server-side, and RLS enforces the caller can only insert as themselves.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("post_reports").insert({
      target_id: data.targetId,
      target_kind: data.targetKind,
      reason: data.reason,
      note: data.note ?? null,
      reporter_id: context.userId,
    });
    if (error) {
      console.error("[submitReport] insert failed", error);
      throw new Error("Failed to submit report");
    }
    return { ok: true };
  });
