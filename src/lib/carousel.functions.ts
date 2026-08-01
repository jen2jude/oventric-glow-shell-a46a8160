import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Persist the "feature carousel seen" flag to the user's profile so the
 * introduction does not reappear on other devices once completed.
 */
export const markCarouselSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ has_seen_feature_carousel: true })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
