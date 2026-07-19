import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";

type Filter = { column: string; value: string } | null;

/**
 * Section live counter.
 *
 * Subscribes to INSERTs on a Supabase table (optionally filtered) and
 * increments a counter whenever the current section is NOT the active one.
 * When the user opens the section, the counter clears.
 *
 * The counter is persisted in `localStorage` under `oventric:count:<section>`
 * so it survives navigation and reloads until the user visits the section.
 */
export function useSectionLiveCounter({
  section,
  table,
  filter = null,
  active,
  requireAuth = false,
  excludeSelf = false,
}: {
  section: string;
  table: string;
  filter?: Filter;
  active: boolean;
  requireAuth?: boolean;
  excludeSelf?: boolean;
}) {
  const { isAuthenticated } = useAuthGate();
  const storageKey = `oventric:count:${section}`;
  const [count, setCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(storageKey);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });

  const clear = useCallback(() => {
    setCount(0);
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  // Clear as soon as the section becomes active.
  useEffect(() => {
    if (active) clear();
  }, [active, clear]);

  useEffect(() => {
    if (requireAuth && !isAuthenticated) return;
    let cancelled = false;
    let userId: string | null = null;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      if (excludeSelf) {
        const { data } = await supabase.auth.getUser();
        userId = data.user?.id ?? null;
      }
      if (cancelled) return;

      const cfg: {
        event: "INSERT";
        schema: string;
        table: string;
        filter?: string;
      } = { event: "INSERT", schema: "public", table };
      if (filter) cfg.filter = `${filter.column}=eq.${filter.value}`;

      ch = supabase
        .channel(`live-count-${section}`)
        .on("postgres_changes", cfg, (payload) => {
          if (excludeSelf && userId) {
            const row = payload.new as Record<string, unknown>;
            if (row.user_id === userId || row.author_id === userId || row.seller_id === userId) return;
          }
          setCount((prev) => {
            const next = prev + 1;
            if (typeof window !== "undefined")
              window.localStorage.setItem(storageKey, String(next));
            return next;
          });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [section, table, filter?.column, filter?.value, requireAuth, isAuthenticated, excludeSelf, storageKey]);

  return { count, clear };
}
