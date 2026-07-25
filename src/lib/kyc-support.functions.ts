import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  reason: z.string().trim().min(3).max(80),
  contact: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(2000),
  selfieAttempts: z.number().int().min(0).max(20).optional(),
  idAttempts: z.number().int().min(0).max(20).optional(),
});

/**
 * Log a KYC manual-review support request. Used when live face-matching
 * and stored-ID matching both fail. Admins pick these up from audit_logs.
 */
export const submitKycSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => schema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: context.userId,
      action: "kyc_manual_review_request",
      target_kind: "user",
      target_id: context.userId,
      meta: {
        reason: data.reason,
        contact: data.contact,
        message: data.message,
        selfie_attempts: data.selfieAttempts ?? null,
        id_attempts: data.idAttempts ?? null,
        at: new Date().toISOString(),
      },
    });
    return { ok: true as const };
  });
