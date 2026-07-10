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
    // Auth-only: the requireSupabaseAuth middleware blocks anonymous callers,
    // so only signed-in users can file reports. context.userId is available
    // for audit log correlation if needed.
    void context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("post_reports").insert({
      target_id: data.targetId,
      target_kind: data.targetKind,
      reason: data.reason,
      note: data.note ?? null,
    });
    if (error) {
      console.error("[submitReport] insert failed", error);
      throw new Error("Failed to submit report");
    }
    return { ok: true };
  });
