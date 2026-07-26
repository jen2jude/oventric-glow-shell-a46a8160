import type { Currency } from "@/lib/onboarding/OnboardingContext";

/**
 * Snapshot object stored on rows (products/bounties/courses). Rates are always
 * USD-base ("1 USD = X <currency>"). See src/lib/fx.functions.ts for how these
 * are minted at publish time.
 */
export interface FxSnapshot {
  base: "USD";
  rates: Partial<Record<Currency, number>>;
  source?: string;
  fetched_at?: string;
}

/**
 * Fallback rates used ONLY for legacy rows that were created before the FX
 * snapshot system existed. These match the platform's historical default —
 * legacy rows are treated as USD-native so their `price_usd` still renders
 * sensibly for viewers on other currencies.
 */
export const LEGACY_USD_RATES: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };

const SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

export function formatMoney(amount: number, currency: Currency): string {
  const rounded = currency === "USD" ? amount.toFixed(2) : Math.round(amount).toLocaleString();
  return `${SYMBOL[currency]}${rounded}`;
}

export function currencySymbol(currency: Currency): string {
  return SYMBOL[currency];
}

function isCurrency(c: unknown): c is Currency {
  return c === "USD" || c === "NGN" || c === "GHS";
}

function normalizeSnapshot(raw: unknown): FxSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rates = obj.rates as Record<string, number> | undefined;
  if (!rates || typeof rates !== "object") return null;
  const usd = Number(rates.USD ?? 1);
  const ngn = Number(rates.NGN);
  const ghs = Number(rates.GHS);
  return {
    base: "USD",
    rates: {
      USD: usd > 0 ? usd : 1,
      NGN: ngn > 0 ? ngn : undefined,
      GHS: ghs > 0 ? ghs : undefined,
    },
    source: typeof obj.source === "string" ? (obj.source as string) : undefined,
    fetched_at: typeof obj.fetched_at === "string" ? (obj.fetched_at as string) : undefined,
  };
}

export type FxValidation =
  | { ok: true; snapshot: FxSnapshot; missingRateFor: null }
  | { ok: false; reason: "missing" | "malformed" | "missing_rate"; missingRateFor: Currency | null };

/**
 * Validate a row's FX snapshot against the viewer's currency. Returns a
 * structured result so the UI can decide whether to warn or block checkout.
 */
export function validateFxSnapshot(row: PriceableRow | null | undefined, viewer: Currency): FxValidation {
  if (!row) return { ok: false, reason: "missing", missingRateFor: null };
  const raw = row.fx_snapshot;
  if (raw === null || raw === undefined) return { ok: false, reason: "missing", missingRateFor: null };
  const snapshot = normalizeSnapshot(raw);
  if (!snapshot) return { ok: false, reason: "malformed", missingRateFor: null };
  const originalCurrency: Currency = isCurrency(row.original_currency) ? row.original_currency : "USD";
  const fromRate = snapshot.rates[originalCurrency];
  const toRate = snapshot.rates[viewer];
  if (!(Number(fromRate) > 0)) return { ok: false, reason: "missing_rate", missingRateFor: originalCurrency };
  if (!(Number(toRate) > 0)) return { ok: false, reason: "missing_rate", missingRateFor: viewer };
  return { ok: true, snapshot, missingRateFor: null };
}

/**
 * Convert an amount between two currencies using a snapshot (USD-base rates).
 * Falls back to LEGACY_USD_RATES if the snapshot is missing a rate — this is
 * only relevant for rows created before the snapshot system.
 */
export function convertViaSnapshot(
  amount: number,
  from: Currency,
  to: Currency,
  snapshot: FxSnapshot | null | undefined,
): number {
  if (from === to || !(amount > 0)) return amount;
  const rates = snapshot?.rates ?? {};
  const fromRate = Number(rates[from] ?? LEGACY_USD_RATES[from]);
  const toRate = Number(rates[to] ?? LEGACY_USD_RATES[to]);
  if (!(fromRate > 0) || !(toRate > 0)) return amount;
  return (amount / fromRate) * toRate;
}

/**
 * A minimal shape describing any listing row. All three snapshot fields are
 * optional — legacy rows fall back to `price_usd` interpreted as USD.
 */
export interface PriceableRow {
  original_currency?: string | null;
  original_amount?: number | null;
  fx_snapshot?: unknown;
  price_usd?: number | null;
}

export interface DisplayPrice {
  /** Value in the LISTING's original currency (the static price the seller set). */
  value: number;
  currency: Currency;
  /** Formatted using the ORIGINAL price/currency — this is the main static price shown everywhere. */
  formatted: string;
  /** Approximate equivalent in the viewer's currency, e.g. "≈ ₦500". Null when viewer matches original. */
  originalFormatted: string | null;
  /** Viewer-currency approximation (same as originalFormatted). Prefer this name in new code. */
  approxFormatted: string | null;
  approxCurrency: Currency;
  approxValue: number;
  originalCurrency: Currency;
  originalAmount: number;
  /** USD equivalent from the snapshot (canonical amount used for wallets/orders). */
  usd: number;
  /** True when the row has a real FX snapshot (locked at publish). */
  isLocked: boolean;
}

/**
 * Compute how a listing should be displayed.
 *
 * The seller's originally posted price + currency is the STATIC main price
 * shown to every viewer. A viewer-currency approximation is provided as a
 * secondary hint only when the viewer's currency differs from the original.
 */
export function computeDisplayPrice(row: PriceableRow, viewer: Currency): DisplayPrice {
  try {
    const safeViewer: Currency = isCurrency(viewer) ? viewer : "USD";
    const snapshot = normalizeSnapshot(row?.fx_snapshot);
    const originalCurrency: Currency = isCurrency(row?.original_currency)
      ? row.original_currency
      : "USD";
    const rawAmount = Number(row?.original_amount ?? row?.price_usd ?? 0);
    const originalAmount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;

    const approx = convertViaSnapshot(originalAmount, originalCurrency, safeViewer, snapshot);
    const usd =
      originalCurrency === "USD"
        ? originalAmount
        : convertViaSnapshot(originalAmount, originalCurrency, "USD", snapshot);

    const safeApprox = Number.isFinite(approx) ? approx : originalAmount;
    const safeUsd = Number.isFinite(usd) ? usd : originalAmount;
    const approxFormatted =
      originalCurrency !== safeViewer ? `≈ ${formatMoney(safeApprox, safeViewer)}` : null;

    return {
      value: originalAmount,
      currency: originalCurrency,
      formatted: formatMoney(originalAmount, originalCurrency),
      originalFormatted: approxFormatted,
      approxFormatted,
      approxCurrency: safeViewer,
      approxValue: safeApprox,
      originalCurrency,
      originalAmount,
      usd: safeUsd,
      isLocked: snapshot !== null,
    };
  } catch {
    const fallbackAmount = Number(row?.price_usd ?? row?.original_amount ?? 0) || 0;
    const safeViewer: Currency = isCurrency(viewer) ? viewer : "USD";
    return {
      value: fallbackAmount,
      currency: "USD",
      formatted: formatMoney(fallbackAmount, "USD"),
      originalFormatted: null,
      approxFormatted: null,
      approxCurrency: safeViewer,
      approxValue: fallbackAmount,
      originalCurrency: "USD",
      originalAmount: fallbackAmount,
      usd: fallbackAmount,
      isLocked: false,
    };
  }
}


/**
 * Safe wrapper for callers that want a plain formatted string. Guarantees a
 * renderable value even when `row` is null/undefined or the snapshot is junk.
 */
export function safeFormatDisplayPrice(row: PriceableRow | null | undefined, viewer: Currency): string {
  if (!row) return formatMoney(0, isCurrency(viewer) ? viewer : "USD");
  return computeDisplayPrice(row, viewer).formatted;
}
