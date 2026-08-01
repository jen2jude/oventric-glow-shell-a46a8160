import { createServerFn } from "@tanstack/react-start";
import { resolveFxRates, type FxSnapshotResult } from "@/lib/fx.server";

export type { FxSnapshotResult } from "@/lib/fx.server";

/**
 * Snapshot the current USD-base FX rates (live market, with admin/manual
 * fallback). Stored on rows at publish time so the seller's own price is
 * always reproducible.
 */
export const snapshotFxRates = createServerFn({ method: "POST" }).handler(
  async (): Promise<FxSnapshotResult> => await resolveFxRates(),
);

/**
 * Current live FX rates for display. The client refreshes these periodically so
 * buyers and sellers in different countries see near-accurate conversions.
 */
export const getLiveFxRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<FxSnapshotResult> => await resolveFxRates(),
);
