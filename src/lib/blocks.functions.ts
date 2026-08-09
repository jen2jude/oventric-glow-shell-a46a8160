import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TargetInput = z.object({ targetId: z.string().uuid() });

/** Blocks a member for the signed-in viewer (idempotent). */
export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.targetId === context.userId) throw new Error("You can't block yourself");
    const { error } = await context.supabase
      .from("user_blocks")
      .upsert(
        { blocker_id: context.userId, blocked_id: data.targetId },
        { onConflict: "blocker_id,blocked_id" },
      );
    if (error) {
      console.error("[blockUser]", error);
      throw new Error("Failed to block this member");
    }
    return { ok: true };
  });

/** Removes a block for the signed-in viewer. */
export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", context.userId)
      .eq("blocked_id", data.targetId);
    if (error) throw new Error("Failed to unblock this member");
    return { ok: true };
  });

/** Ids the signed-in viewer has blocked. */
export const listBlockedIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", context.userId);
    if (error) return [];
    return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
  });
