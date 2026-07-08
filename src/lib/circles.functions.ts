import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SlugInput = z.object({
  targetSlug: z.string().trim().min(1).max(120),
});

export type CircleStatus = "none" | "pending" | "accepted";

export const getCircleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<{ status: CircleStatus }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("circle_requests")
      .select("status")
      .eq("requester_id", userId)
      .eq("target_slug", data.targetSlug)
      .maybeSingle();
    if (error) {
      console.error("[getCircleStatus] failed", error);
      throw new Error("Failed to load circle status");
    }
    if (!row) return { status: "none" };
    return { status: row.status as CircleStatus };
  });

export const sendCircleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<{ status: CircleStatus }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("circle_requests")
      .upsert(
        { requester_id: userId, target_slug: data.targetSlug, status: "pending" },
        { onConflict: "requester_id,target_slug", ignoreDuplicates: false },
      )
      .select("status")
      .single();
    if (error) {
      console.error("[sendCircleRequest] failed", error);
      throw new Error("Failed to send request");
    }
    return { status: row.status as CircleStatus };
  });

export const cancelCircleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<{ status: CircleStatus }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("circle_requests")
      .delete()
      .eq("requester_id", userId)
      .eq("target_slug", data.targetSlug);
    if (error) {
      console.error("[cancelCircleRequest] failed", error);
      throw new Error("Failed to cancel request");
    }
    return { status: "none" };
  });

// Simulates the target profile accepting the pending request. Uses the
// service role because the target is a mock (non-auth) identity in this demo,
// so no end user has update rights on the row.
export const acceptCircleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<{ status: CircleStatus }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("circle_requests")
      .update({ status: "accepted" })
      .eq("requester_id", userId)
      .eq("target_slug", data.targetSlug)
      .select("status")
      .single();
    if (error || !row) {
      console.error("[acceptCircleRequest] failed", error);
      throw new Error("Failed to accept request");
    }
    return { status: row.status as CircleStatus };
  });
