import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuthGate, type AuthGateContextKey } from "@/lib/auth-gate/AuthGateProvider";

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export type Stage = 1 | 2 | 3 | 4 | 5;
export type Country = "NG" | "GH" | "OTHER";
export type Currency = "USD" | "NGN" | "GHS";

/**
 * Country → base currency map. Nigeria uses NGN, Ghana uses GHS, everywhere
 * else (OTHER) falls back to USD. This is the single source of truth used
 * both when a user picks their country during onboarding and when hydrating
 * an already-completed profile at sign-in.
 */
export function countryToCurrency(country: Country | null | undefined): Currency {
  if (country === "NG") return "NGN";
  if (country === "GH") return "GHS";
  return "USD";
}

/**
 * Parses a raw country value from the database into the coarse Country enum.
 * Legacy "US"/"UK" rows and any user-typed free-form country name all map to
 * "OTHER" (USD baseline).
 */
export function parseCountry(raw: string | null | undefined): Country | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === "NG") return "NG";
  if (v === "GH") return "GH";
  return "OTHER";
}

/**
 * Countries whose native currency is USD. Only "OTHER" (or unknown) users
 * default to USD; NG/GH keep their local currency.
 */
export function isUsdNativeCountry(country: Country | null | undefined): boolean {
  return country === "OTHER" || country == null;
}

export function canTransactInUsd(country: Country | null | undefined): boolean {
  // USD is a global rail — always available. Non-USD-native countries get it
  // as a secondary transaction currency alongside their base currency.
  return true;
}


export type PayoutBank =
  | { country: "NG"; bank: string; accountNumber: string; accountName: string }
  | { country: "GH"; network: string; momoNumber: string; walletName: string }
  | null;

interface OnboardingState {
  tier: Tier;
  country: Country | null;
  fullName: string;
  storeName: string;
  phone: string;
  baseCurrency: Currency;
  payoutBank: PayoutBank;
  balances: Record<Currency, number>;
  escrow: Record<Currency, number>;
  cashback: number;
  balancesHidden: boolean;
}

interface OnboardingContextValue extends OnboardingState {
  openStage: Stage | null;
  setOpenStage: (s: Stage | null) => void;
  require: (minTier: Tier, onSuccess?: () => void, authContext?: AuthGateContextKey) => void;
  advanceTo: (t: Tier, patch?: Partial<OnboardingState>) => void;
  setBaseCurrency: (c: Currency) => void;
  updateBalance: (c: Currency, delta: number) => void;
  setBalances: (balances: Record<Currency, number>, escrow?: Record<Currency, number>, cashback?: number) => void;
  setBalancesHidden: (hidden: boolean) => void;
  toggleBalancesHidden: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    tier: 0,
    country: null,
    fullName: "",
    storeName: "",
    phone: "",
    baseCurrency: "USD",
    payoutBank: null,
    balances: { USD: 0, NGN: 0, GHS: 0 },
    escrow: { USD: 0, NGN: 0, GHS: 0 },
    cashback: 0,
    balancesHidden: false,
  });
  const [openStage, setOpenStage] = useState<Stage | null>(null);
  const [pending, setPending] = useState<{ minTier: Tier; cb?: () => void } | null>(null);

  const { ensureUserAuthenticated } = useAuthGate();

  const require = useCallback(
    (minTier: Tier, onSuccess?: () => void, authContext: AuthGateContextKey = "generic") => {
      // Global auth gate always fires first. If the user is already signed in
      // this resolves synchronously and we fall straight through to the tier
      // ladder; otherwise the OTP modal opens and the pending callback
      // re-enters this branch after SIGNED_IN.
      ensureUserAuthenticated(() => {
        if (state.tier >= minTier || minTier <= 1) {
          onSuccess?.();
          return;
        }
        // Stage 1 (email verification) is fully owned by the AuthGate — the
        // progressive Stage 1 modal is removed. Open at Stage 2 or later.
        const nextStage = Math.max(state.tier + 1, 2) as Stage;
        setPending({ minTier, cb: onSuccess });
        setOpenStage(nextStage);
      }, authContext);
    },
    [state.tier, ensureUserAuthenticated],
  );

  const advanceTo = useCallback(
    (t: Tier, patch?: Partial<OnboardingState>) => {
      setState((s) => {
        const merged = { ...s, ...patch, tier: t };
        // Re-derive base currency from country whenever country is set/changed
        // so the wallet + top-up currency stay locked to the profile country.
        if (patch && "country" in patch) {
          merged.baseCurrency = countryToCurrency(merged.country);
        }
        return merged;
      });
      // If reached the pending target, run callback and close.
      setPending((p) => {
        if (p && t >= p.minTier) {
          setOpenStage(null);
          setTimeout(() => p.cb?.(), 50);
          return null;
        }
        // otherwise auto-advance to next stage
        if (p) {
          setOpenStage(((t + 1) as Stage) <= 5 ? ((t + 1) as Stage) : null);
        } else {
          setOpenStage(null);
        }
        return p;
      });
    },
    [],
  );

  // Base currency is LOCKED to the user's country: US/UK/OTHER → USD, NG → NGN,
  // GH → GHS. The setter is retained for backwards compatibility but silently
  // enforces the country-derived value — passing a different currency is a
  // no-op. Country changes flow through advanceTo / profile hydration.
  const setBaseCurrency = useCallback(
    (_c: Currency) =>
      setState((s) => ({ ...s, baseCurrency: countryToCurrency(s.country) })),
    [],
  );
  const updateBalance = useCallback(
    (c: Currency, delta: number) => setState((s) => ({ ...s, balances: { ...s.balances, [c]: s.balances[c] + delta } })),
    [],
  );
  const setBalances = useCallback(
    (balances: Record<Currency, number>, escrow?: Record<Currency, number>, cashback?: number) =>
      setState((s) => ({
        ...s,
        balances,
        escrow: escrow ?? s.escrow,
        cashback: cashback ?? s.cashback,
      })),
    [],
  );
  const setBalancesHidden = useCallback(
    (hidden: boolean) => setState((s) => ({ ...s, balancesHidden: hidden })),
    [],
  );
  const toggleBalancesHidden = useCallback(
    () => setState((s) => ({ ...s, balancesHidden: !s.balancesHidden })),
    [],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      openStage,
      setOpenStage: (s) => {
        if (s === null) setPending(null);
        setOpenStage(s);
      },
      require,
      advanceTo,
      setBaseCurrency,
      updateBalance,
      setBalances,
      setBalancesHidden,
      toggleBalancesHidden,
    }),
    [state, openStage, require, advanceTo, setBaseCurrency, updateBalance, setBalances, setBalancesHidden, toggleBalancesHidden],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
