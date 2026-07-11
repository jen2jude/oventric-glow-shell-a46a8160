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
  /** Value in viewer's currency. */
  value: number;
  currency: Currency;
  formatted: string;
  /** e.g. "≈ ₵850" when the row's original currency differs from the viewer's. */
  originalFormatted: string | null;
  originalCurrency: Currency;
  originalAmount: number;
  /** USD equivalent from the snapshot (canonical amount used for wallets/orders). */
  usd: number;
  /** True when the row has a real FX snapshot (locked at publish). */
  isLocked: boolean;
}

/**
 * Compute how a listing should be displayed in the viewer's base currency.
 *
 * - If the row has a snapshot: convert from `original_currency` → viewer using
 *   the snapshot rates. The amount is truly locked.
 * - Otherwise: treat `price_usd` as USD-native and convert with fallback rates.
 */
export function computeDisplayPrice(row: PriceableRow, viewer: Currency): DisplayPrice {
  const snapshot = normalizeSnapshot(row.fx_snapshot);
  const originalCurrency: Currency = isCurrency(row.original_currency)
    ? row.original_currency
    : "USD";
  const originalAmount = Number(row.original_amount ?? row.price_usd ?? 0);

  const value = convertViaSnapshot(originalAmount, originalCurrency, viewer, snapshot);
  const usd =
    originalCurrency === "USD"
      ? originalAmount
      : convertViaSnapshot(originalAmount, originalCurrency, "USD", snapshot);

  return {
    value,
    currency: viewer,
    formatted: formatMoney(value, viewer),
    originalFormatted:
      originalCurrency !== viewer ? formatMoney(originalAmount, originalCurrency) : null,
    originalCurrency,
    originalAmount,
    usd,
    isLocked: snapshot !== null,
  };
}
