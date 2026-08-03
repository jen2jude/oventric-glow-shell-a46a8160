import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared realtime presence. Joins the same `oventric:presence` topic the
 * messaging rail uses, so "online" is consistent everywhere in the app.
 * Returns the set of currently-online user ids (including the viewer).
 */
export function useOnlineUsers(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const me = data.session?.user?.id ?? null;
      if (cancelled || !me) return;

      channel = supabase.channel("oventric:presence", {
        config: { presence: { key: me } },
      });

      const sync = () => {
        if (cancelled || !channel) return;
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      };

      channel
        .on("presence", { event: "sync" }, sync)
        .on("presence", { event: "join" }, sync)
        .on("presence", { event: "leave" }, sync)
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED" || cancelled || !channel) return;
          await channel.track({ user_id: me, online_at: new Date().toISOString() });
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return online;
}
