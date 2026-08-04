import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PromoEventKind = "impression" | "click";

const SESSION_KEY = "oventric:promo-session";
const seen = new Set<string>();

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function trackPromoEvent(
  kind: PromoEventKind,
  promo: { id: string; title?: string; surface?: string },
) {
  if (typeof window === "undefined") return;
  const surface = promo.surface ?? "home";
  // Impressions are counted once per promo per session to keep the data useful.
  if (kind === "impression") {
    const key = `${surface}:${promo.id}`;
    if (seen.has(key)) return;
    seen.add(key);
  }
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("promo_events").insert({
      promo_id: promo.id,
      promo_title: promo.title ?? null,
      kind,
      surface,
      session_id: sessionId(),
      user_id: data.user?.id ?? null,
    });
  } catch {
    // analytics must never break the UI
  }
}

/** Fires a single impression event when the element is at least half visible. */
export function usePromoImpression<T extends HTMLElement>(promo: {
  id: string;
  title?: string;
  surface?: string;
}) {
  const ref = useRef<T | null>(null);
  const fired = useRef(false);
  const { id, title, surface } = promo;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !fired.current) {
            fired.current = true;
            void trackPromoEvent("impression", { id, title, surface });
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, title, surface]);

  return ref;
}
