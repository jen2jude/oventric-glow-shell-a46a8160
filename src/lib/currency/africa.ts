/**
 * Pan-African country + currency registry.
 *
 * Single source of truth for:
 *  - which countries a user can pick during onboarding
 *  - which currency their wallet, marketplace prices, bounties, academy
 *    purchases, funding and withdrawals default to
 *  - display symbols, decimal precision and last-resort USD fallback rates
 *
 * Everything is USD-base: `fallbackRate` means "1 USD = N <currency>".
 * Live rates replace these at runtime (see src/lib/fx.server.ts).
 */

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  /** Display decimals. USD-like currencies use 2; low-denomination ones use 0. */
  decimals: 0 | 2;
  /** Last-resort "1 USD = N" rate when live FX and admin rates are unavailable. */
  fallbackRate: number;
}

const C = (
  code: string,
  name: string,
  symbol: string,
  decimals: 0 | 2,
  fallbackRate: number,
): CurrencyMeta => ({ code, name, symbol, decimals, fallbackRate });

/** Every currency the platform can hold, price and settle in. */
export const CURRENCY_LIST: CurrencyMeta[] = [
  C("USD", "US Dollar", "$", 2, 1),
  C("NGN", "Nigerian Naira", "₦", 0, 1364),
  C("GHS", "Ghanaian Cedi", "₵", 0, 11.7),
  C("ZAR", "South African Rand", "R", 2, 18.1),
  C("KES", "Kenyan Shilling", "KSh", 0, 129),
  C("EGP", "Egyptian Pound", "E£", 2, 48.5),
  C("MAD", "Moroccan Dirham", "DH", 2, 9.9),
  C("DZD", "Algerian Dinar", "DA", 2, 133),
  C("TND", "Tunisian Dinar", "DT", 2, 3.1),
  C("LYD", "Libyan Dinar", "LD", 2, 4.85),
  C("XOF", "West African CFA Franc", "CFA", 0, 605),
  C("XAF", "Central African CFA Franc", "FCFA", 0, 605),
  C("ETB", "Ethiopian Birr", "Br", 2, 127),
  C("UGX", "Ugandan Shilling", "USh", 0, 3660),
  C("TZS", "Tanzanian Shilling", "TSh", 0, 2620),
  C("RWF", "Rwandan Franc", "FRw", 0, 1390),
  C("BIF", "Burundian Franc", "FBu", 0, 2960),
  C("CDF", "Congolese Franc", "FC", 0, 2860),
  C("AOA", "Angolan Kwanza", "Kz", 0, 915),
  C("MZN", "Mozambican Metical", "MT", 2, 63.9),
  C("ZMW", "Zambian Kwacha", "ZK", 2, 25.5),
  C("MWK", "Malawian Kwacha", "MK", 0, 1735),
  C("BWP", "Botswana Pula", "P", 2, 13.6),
  C("NAD", "Namibian Dollar", "N$", 2, 18.1),
  C("LSL", "Lesotho Loti", "L", 2, 18.1),
  C("SZL", "Eswatini Lilangeni", "E", 2, 18.1),
  C("MUR", "Mauritian Rupee", "₨", 2, 46.5),
  C("SCR", "Seychellois Rupee", "SR", 2, 14.3),
  C("CVE", "Cape Verdean Escudo", "$", 2, 102),
  C("GMD", "Gambian Dalasi", "D", 2, 71),
  C("GNF", "Guinean Franc", "FG", 0, 8620),
  C("LRD", "Liberian Dollar", "L$", 2, 190),
  C("SLE", "Sierra Leonean Leone", "Le", 2, 22.7),
  C("SDG", "Sudanese Pound", "SDG", 2, 601),
  C("SSP", "South Sudanese Pound", "SSP", 2, 4570),
  C("SOS", "Somali Shilling", "Sh", 0, 571),
  C("DJF", "Djiboutian Franc", "Fdj", 0, 178),
  C("ERN", "Eritrean Nakfa", "Nfk", 2, 15),
  C("KMF", "Comorian Franc", "CF", 0, 455),
  C("MGA", "Malagasy Ariary", "Ar", 0, 4560),
  C("MRU", "Mauritanian Ouguiya", "UM", 2, 39.8),
  C("STN", "São Tomé Dobra", "Db", 2, 22.7),
  C("ZWG", "Zimbabwe Gold", "ZiG", 2, 26.5),
];

export const CURRENCY_META: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCY_LIST.map((c) => [c.code, c]),
);

export const CURRENCY_CODES = CURRENCY_LIST.map((c) => c.code);

export interface CountryMeta {
  code: string;
  name: string;
  flag: string;
  currency: string;
  dial: string;
}

const K = (code: string, name: string, flag: string, currency: string, dial: string): CountryMeta => ({
  code,
  name,
  flag,
  currency,
  dial,
});

/** All 54 African countries, alphabetical. */
export const AFRICA_COUNTRIES: CountryMeta[] = [
  K("DZ", "Algeria", "🇩🇿", "DZD", "+213"),
  K("AO", "Angola", "🇦🇴", "AOA", "+244"),
  K("BJ", "Benin", "🇧🇯", "XOF", "+229"),
  K("BW", "Botswana", "🇧🇼", "BWP", "+267"),
  K("BF", "Burkina Faso", "🇧🇫", "XOF", "+226"),
  K("BI", "Burundi", "🇧🇮", "BIF", "+257"),
  K("CV", "Cabo Verde", "🇨🇻", "CVE", "+238"),
  K("CM", "Cameroon", "🇨🇲", "XAF", "+237"),
  K("CF", "Central African Republic", "🇨🇫", "XAF", "+236"),
  K("TD", "Chad", "🇹🇩", "XAF", "+235"),
  K("KM", "Comoros", "🇰🇲", "KMF", "+269"),
  K("CG", "Congo (Brazzaville)", "🇨🇬", "XAF", "+242"),
  K("CD", "Congo (Kinshasa)", "🇨🇩", "CDF", "+243"),
  K("CI", "Côte d'Ivoire", "🇨🇮", "XOF", "+225"),
  K("DJ", "Djibouti", "🇩🇯", "DJF", "+253"),
  K("EG", "Egypt", "🇪🇬", "EGP", "+20"),
  K("GQ", "Equatorial Guinea", "🇬🇶", "XAF", "+240"),
  K("ER", "Eritrea", "🇪🇷", "ERN", "+291"),
  K("SZ", "Eswatini", "🇸🇿", "SZL", "+268"),
  K("ET", "Ethiopia", "🇪🇹", "ETB", "+251"),
  K("GA", "Gabon", "🇬🇦", "XAF", "+241"),
  K("GM", "Gambia", "🇬🇲", "GMD", "+220"),
  K("GH", "Ghana", "🇬🇭", "GHS", "+233"),
  K("GN", "Guinea", "🇬🇳", "GNF", "+224"),
  K("GW", "Guinea-Bissau", "🇬🇼", "XOF", "+245"),
  K("KE", "Kenya", "🇰🇪", "KES", "+254"),
  K("LS", "Lesotho", "🇱🇸", "LSL", "+266"),
  K("LR", "Liberia", "🇱🇷", "LRD", "+231"),
  K("LY", "Libya", "🇱🇾", "LYD", "+218"),
  K("MG", "Madagascar", "🇲🇬", "MGA", "+261"),
  K("MW", "Malawi", "🇲🇼", "MWK", "+265"),
  K("ML", "Mali", "🇲🇱", "XOF", "+223"),
  K("MR", "Mauritania", "🇲🇷", "MRU", "+222"),
  K("MU", "Mauritius", "🇲🇺", "MUR", "+230"),
  K("MA", "Morocco", "🇲🇦", "MAD", "+212"),
  K("MZ", "Mozambique", "🇲🇿", "MZN", "+258"),
  K("NA", "Namibia", "🇳🇦", "NAD", "+264"),
  K("NE", "Niger", "🇳🇪", "XOF", "+227"),
  K("NG", "Nigeria", "🇳🇬", "NGN", "+234"),
  K("RW", "Rwanda", "🇷🇼", "RWF", "+250"),
  K("ST", "São Tomé and Príncipe", "🇸🇹", "STN", "+239"),
  K("SN", "Senegal", "🇸🇳", "XOF", "+221"),
  K("SC", "Seychelles", "🇸🇨", "SCR", "+248"),
  K("SL", "Sierra Leone", "🇸🇱", "SLE", "+232"),
  K("SO", "Somalia", "🇸🇴", "SOS", "+252"),
  K("ZA", "South Africa", "🇿🇦", "ZAR", "+27"),
  K("SS", "South Sudan", "🇸🇸", "SSP", "+211"),
  K("SD", "Sudan", "🇸🇩", "SDG", "+249"),
  K("TZ", "Tanzania", "🇹🇿", "TZS", "+255"),
  K("TG", "Togo", "🇹🇬", "XOF", "+228"),
  K("TN", "Tunisia", "🇹🇳", "TND", "+216"),
  K("UG", "Uganda", "🇺🇬", "UGX", "+256"),
  K("ZM", "Zambia", "🇿🇲", "ZMW", "+260"),
  K("ZW", "Zimbabwe", "🇿🇼", "ZWG", "+263"),
];

/** Includes the "rest of world" USD bucket used by non-African members. */
export const ALL_COUNTRIES: CountryMeta[] = [
  ...AFRICA_COUNTRIES,
  K("OTHER", "Other (rest of world)", "🌍", "USD", "+"),
];

export const COUNTRY_META: Record<string, CountryMeta> = Object.fromEntries(
  ALL_COUNTRIES.map((c) => [c.code, c]),
);

/** Normalise a raw stored country value to a known country code, or null. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (COUNTRY_META[upper]) return upper;
  const byName = ALL_COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase());
  return byName ? byName.code : "OTHER";
}

/** Country code → home currency. Unknown / rest-of-world → USD. */
export function currencyForCountry(country: string | null | undefined): string {
  const code = normalizeCountryCode(country);
  if (!code) return "USD";
  return COUNTRY_META[code]?.currency ?? "USD";
}

export function isSupportedCurrency(code: unknown): boolean {
  return typeof code === "string" && Boolean(CURRENCY_META[code.toUpperCase()]);
}

export function currencyDecimals(code: string): 0 | 2 {
  return CURRENCY_META[code]?.decimals ?? 2;
}

export function currencyFallbackRate(code: string): number {
  return CURRENCY_META[code]?.fallbackRate ?? 1;
}

/** Currencies Paystack can charge/settle directly. Everything else routes via USD. */
export const PAYSTACK_CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;

export function isPaystackCurrency(code: string): boolean {
  return (PAYSTACK_CURRENCIES as readonly string[]).includes(code);
}

/** The currency a gateway charge should actually be created in. */
export function gatewayCurrency(code: string): string {
  return isPaystackCurrency(code) ? code : "USD";
}

/** Zeroed balance map covering every supported currency. */
export function zeroAmounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CURRENCY_CODES) out[c] = 0;
  return out;
}

/** Static USD-base fallback rate table. */
export function fallbackRateTable(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CURRENCY_LIST) out[c.code] = c.fallbackRate;
  return out;
}

/** The DB enum variant of a currency code (wallets / wallet_transactions). */
export type DbCurrency =
  import("@/integrations/supabase/types").Database["public"]["Enums"]["wallet_currency"];

/** Narrow an arbitrary currency string to the DB enum, defaulting to USD. */
export function dbCurrency(code: string | null | undefined): DbCurrency {
  const c = String(code ?? "").toUpperCase();
  return (CURRENCY_META[c] ? c : "USD") as DbCurrency;
}
