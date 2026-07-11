import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * FX snapshot stored on every publishable row (products, bounties, courses).
 * Rates are USD-base ("USD → target"). We only fetch NGN + GHS today because
 * those are the non-USD base currencies supported by the platform.
 *
 * When a user publishes, we snapshot the market rate ONCE and never mutate it
 * again — the price a viewer sees in their own base currency is derived from
 * this snapshot, so the amount stays locked even if the market moves.
 */
export interface FxSnapshotResult {
  base: "USD";
  rates: { USD: number; NGN: number; GHS: number };
  source: "live" | "admin" | "fallback";
  fetched_at: string;
}

const HARD_FALLBACK: FxSnapshotResult["rates"] = { USD: 1, NGN: 1500, GHS: 14 };

async function fetchLiveRates(): Promise<FxSnapshotResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      "https://api.exchangerate.host/latest?base=USD&symbols=NGN,GHS",
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const ngn = Number(json?.rates?.NGN);
    const ghs = Number(json?.rates?.GHS);
    if (!(ngn > 0) || !(ghs > 0)) return null;
    return {
      base: "USD",
      rates: { USD: 1, NGN: ngn, GHS: ghs },
      source: "live",
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
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
    const { data } = await (sb as any)
      .from("platform_settings")
      .select("fx_rates")
      .maybeSingle();
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

/**
 * Snapshot the current USD-base FX rates. Tries live market first
 * (exchangerate.host) and falls back to admin-managed platform_settings.fx_rates
 * on error/timeout. The result is meant to be stored on the row being
 * published and reused for every subsequent conversion — this is what locks
 * the price in.
 */
export const snapshotFxRates = createServerFn({ method: "POST" }).handler(
  async (): Promise<FxSnapshotResult> => {
    const live = await fetchLiveRates();
    if (live) return live;
    return await fetchAdminRates();
  },
);
