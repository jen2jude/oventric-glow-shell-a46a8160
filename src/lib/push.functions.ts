import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key the browser needs to create a push subscription. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["VAPID_PUBLIC_KEY"] ?? null };
});

/** Store (or refresh) the calling user's device push subscription. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => {
    if (!input?.endpoint || !input.p256dh || !input.auth) throw new Error("invalid subscription");
    if (input.endpoint.length > 1000) throw new Error("invalid endpoint");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: (data.userAgent ?? "").slice(0, 300) || null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    return { ok: true };
  });

/** Remove a device subscription (user turned notifications off). */
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => {
    if (!input?.endpoint) throw new Error("invalid endpoint");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
