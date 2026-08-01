import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface FxRates extends Record<string, number> {
  USD: number;
  NGN: number;
  GHS: number;
}

export interface FxSnapshotResult {
  base: "USD";
  rates: FxRates;
  source: "live" | "admin" | "fallback";
  fetched_at: string;
}

/** Last-resort rates if every provider and the admin table are unreachable. */
const HARD_FALLBACK: FxRates = { USD: 1, NGN: 1364, GHS: 11.7 };

/** Server-side memory cache so we don't hit the FX provider on every publish/view. */
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { at: number; value: FxSnapshotResult } | null = null;

async function getJson(url: string, ms = 4500): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function build(ngn: unknown, ghs: unknown): FxSnapshotResult | null {
  const n = Number(ngn);
  const g = Number(ghs);
  if (!(n > 0) || !(g > 0)) return null;
  return {
    base: "USD",
    rates: { USD: 1, NGN: n, GHS: g },
    source: "live",
    fetched_at: new Date().toISOString(),
  };
}

/** Try several key-less providers in order until one returns sane USD-base rates. */
async function fetchLiveRates(): Promise<FxSnapshotResult | null> {
  const a = (await getJson("https://open.er-api.com/v6/latest/USD")) as
    | { result?: string; rates?: Record<string, number> }
    | null;
  if (a?.rates) {
    const built = build(a.rates.NGN, a.rates.GHS);
    if (built) return built;
  }

  const b = (await getJson(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  )) as { usd?: Record<string, number> } | null;
  if (b?.usd) {
    const built = build(b.usd.ngn, b.usd.ghs);
    if (built) return built;
  }

  return null;
}

async function fetchAdminRates(): Promise<FxSnapshotResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const fetched_at = new Date().toISOString();
  if (!url || !key) {
    return { base: "USD", rates: HARD_FALLBACK, source: "fallback", fetched_at };
  }
  try {
    const sb = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any).from("platform_settings").select("fx_rates").maybeSingle();
    const rates = (data?.fx_rates ?? null) as Record<string, number> | null;
    if (!rates) return { base: "USD", rates: HARD_FALLBACK, source: "fallback", fetched_at };
    return {
      base: "USD",
      rates: {
        USD: 1,
        NGN: Number(rates.NGN) > 0 ? Number(rates.NGN) : HARD_FALLBACK.NGN,
        GHS: Number(rates.GHS) > 0 ? Number(rates.GHS) : HARD_FALLBACK.GHS,
      },
      source: "admin",
      fetched_at,
    };
  } catch {
    return { base: "USD", rates: HARD_FALLBACK, source: "fallback", fetched_at };
  }
}

/** Current USD-base rates, cached in memory for 15 minutes. */
export async function resolveFxRates(): Promise<FxSnapshotResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const live = await fetchLiveRates();
  const value = live ?? (await fetchAdminRates());
  // Only cache successful live pulls for the full TTL; retry fallbacks sooner.
  cache = { at: value.source === "live" ? Date.now() : Date.now() - CACHE_TTL_MS + 60_000, value };
  return value;
}
