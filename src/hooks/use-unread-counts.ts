import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

export type SectionUnread = {
  /** Total unread notifications (same number the header bell shows). */
  total: number;
  /** Unread direct messages (same number the header chat icon shows). */
  messages: number;
  /** Unread notifications bucketed into hub sections. */
  sections: Record<string, number>;
};

const EMPTY: SectionUnread = { total: 0, messages: 0, sections: {} };

/** Map a notification `kind` onto a hub section label. */
function sectionForKind(kind: string): string | null {
  if (kind.startsWith("bounty")) return "Bounties";
  if (kind.startsWith("circle")) return "Circles";
  if (kind.startsWith("payout") || kind.startsWith("wallet") || kind.startsWith("cashback"))
    return "Wallet";
  if (kind.startsWith("order") || kind.startsWith("product") || kind.startsWith("sale"))
    return "Market";
  if (kind.startsWith("course") || kind.startsWith("academy") || kind.startsWith("enrol"))
    return "Academy";
  if (kind === "direct_message") return "Messages";
  if (kind.startsWith("post") || kind === "wall_post" || kind.startsWith("comment"))
    return "Feed";
  return null;
}

/**
 * Live unread counters shared by the header and the mobile fintech home hub,
 * so the same red badges appear in both places.
 */
export function useUnreadCounts(): SectionUnread {
  const { isAuthenticated } = useAuthGate();
  const [state, setState] = useState<SectionUnread>(EMPTY);

  useEffect(() => {
    if (!isAuthenticated) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    let userId: string | null = null;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      if (!userId || cancelled) return;
      const [notifRes, dmRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("kind")
          .eq("user_id", userId)
          .is("read_at", null)
          .limit(500),
        supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .is("read_at", null),
      ]);
      if (cancelled) return;
      const rows = (notifRes.data ?? []) as Array<{ kind: string }>;
      const sections: Record<string, number> = {};
      for (const r of rows) {
        const s = sectionForKind(r.kind ?? "");
        if (s) sections[s] = (sections[s] ?? 0) + 1;
      }
      setState({ total: rows.length, messages: dmRes.count ?? 0, sections });
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || cancelled) return;
      await load();
      ch = supabase
        .channel(`unread-counts-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_messages",
            filter: `recipient_id=eq.${userId}`,
          },
          () => void load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [isAuthenticated]);

  return state;
}
