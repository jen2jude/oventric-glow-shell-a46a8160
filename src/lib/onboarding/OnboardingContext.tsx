import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuthGate, type AuthGateContextKey } from "@/lib/auth-gate/AuthGateProvider";

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
        if (state.tier >= minTier) {
          onSuccess?.();
          return;
        }
        const nextStage = (state.tier + 1) as Stage;
        setPending({ minTier, cb: onSuccess });
        setOpenStage(nextStage);
      }, authContext);
    },
    [state.tier, ensureUserAuthenticated],
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
      setBalancesHidden,
      toggleBalancesHidden,
    }),
    [state, openStage, require, advanceTo, setBaseCurrency, updateBalance, setBalancesHidden, toggleBalancesHidden],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
