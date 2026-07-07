import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export type Stage = 1 | 2 | 3 | 4 | 5;
export type Country = "NG" | "GH" | "US" | "UK" | "OTHER";
export type Currency = "USD" | "NGN" | "GHS";

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
}

interface OnboardingContextValue extends OnboardingState {
  openStage: Stage | null;
  setOpenStage: (s: Stage | null) => void;
  require: (minTier: Tier, onSuccess?: () => void) => void;
  advanceTo: (t: Tier, patch?: Partial<OnboardingState>) => void;
  setBaseCurrency: (c: Currency) => void;
  updateBalance: (c: Currency, delta: number) => void;
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
    balances: { USD: 1284.5, NGN: 452000, GHS: 3120 },
  });
  const [openStage, setOpenStage] = useState<Stage | null>(null);
  const [pending, setPending] = useState<{ minTier: Tier; cb?: () => void } | null>(null);

  const require = useCallback(
    (minTier: Tier, onSuccess?: () => void) => {
      if (state.tier >= minTier) {
        onSuccess?.();
        return;
      }
      const nextStage = (state.tier + 1) as Stage;
      setPending({ minTier, cb: onSuccess });
      setOpenStage(nextStage);
    },
    [state.tier],
  );

  const advanceTo = useCallback(
    (t: Tier, patch?: Partial<OnboardingState>) => {
      setState((s) => ({ ...s, ...patch, tier: t }));
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

  const setBaseCurrency = useCallback((c: Currency) => setState((s) => ({ ...s, baseCurrency: c })), []);
  const updateBalance = useCallback(
    (c: Currency, delta: number) => setState((s) => ({ ...s, balances: { ...s.balances, [c]: s.balances[c] + delta } })),
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
    }),
    [state, openStage, require, advanceTo, setBaseCurrency, updateBalance],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
