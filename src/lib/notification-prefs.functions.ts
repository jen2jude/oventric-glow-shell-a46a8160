import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  defaultTopicPrefs,
  isNotificationTopic,
  type TopicPrefs,
} from "@/lib/notifications/topics";

/** Current user's per-topic notification settings (defaults to all on). */
export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopicPrefs> => {
    const { data, error } = await context.supabase
      .from("notification_preferences")
      .select("topic, in_app, push")
      .eq("user_id", context.userId);
    if (error) throw error;
    const prefs = defaultTopicPrefs();
    for (const row of data ?? []) {
      const t = (row as { topic: string }).topic;
      if (!isNotificationTopic(t)) continue;
      prefs[t] = {
        inApp: (row as { in_app: boolean }).in_app,
        push: (row as { push: boolean }).push,
      };
    }
    return prefs;
  });

/** Turn a single channel on/off for one topic. */
export const setNotificationPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { topic: string; inApp: boolean; push: boolean }) => {
    if (!input || !isNotificationTopic(input.topic)) throw new Error("invalid topic");
    return {
      topic: input.topic,
      inApp: Boolean(input.inApp),
      push: Boolean(input.push),
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notification_preferences").upsert(
      {
        user_id: context.userId,
        topic: data.topic,
        in_app: data.inApp,
        push: data.push,
      },
      { onConflict: "user_id,topic" },
    );
    if (error) throw error;
    return { ok: true };
  });
