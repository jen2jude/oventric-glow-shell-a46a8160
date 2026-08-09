import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  seedNewUser as seedNewUserFn,
  getOnboardingStatus as getOnboardingStatusFn,
} from "@/lib/onboarding.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import {
  useOnboarding,
  countryToCurrency,
  parseCountry,
  type Country,
} from "@/lib/onboarding/OnboardingContext";

/**
 * Mounts once at the app root. Whenever a user session is established
 * (initial load with an existing session, or a fresh SIGNED_IN event),
 * calls the idempotent server seeder that ensures a profile row and the
 * three multi-currency wallets exist for the current user.
 *
 * Since triggers on `auth.users` are not permitted on Lovable Cloud, this
 * is the seeding path — it works for email/password signup, OAuth signup,
 * and anonymous sign-in alike.
 */
export function AuthSeeder() {
  const seedNewUser = useServerFn(seedNewUserFn);
  const fetchBalances = useServerFn(getWalletBalances);
  const fetchStatus = useServerFn(getOnboardingStatusFn);
  const { setBalances, advanceTo, setBaseCurrency } = useOnboarding();
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshBalances = async () => {
      try {
        const b = await fetchBalances();
        if (!cancelled) setBalances(b.balances, b.escrow, b.cashback);
      } catch (err) {
        console.error("[AuthSeeder] balances fetch failed", err);
      }
    };

    const seed = async (userId: string | undefined) => {
      if (!userId) {
        // Signed out: zero the ambient balances.
        setBalances({ USD: 0, NGN: 0, GHS: 0 }, { USD: 0, NGN: 0, GHS: 0 }, 0);
        return;
      }
      if (seededFor.current === userId) {
        void refreshBalances();
        return;
      }
      seededFor.current = userId;
      try {
        const seeded = await seedNewUser({ data: {} });
        if (seeded && seeded.staleSession) {
          // The session points at an account that no longer exists.
          seededFor.current = null;
          await supabase.auth.signOut();
          return;
        }
        await refreshBalances();
        // Hydrate the onboarding tier from the persisted profile so returning
        // users who already unlocked commerce don't get re-prompted.
        try {
          const status = await fetchStatus();
          if (cancelled) return;
          const country: Country | null = parseCountry(status.country);
          if (status.profileCompleted) {
            const currency = countryToCurrency(country);
            setBaseCurrency(currency);
            advanceTo(status.kycCompleted ? 5 : 2, {
              fullName: status.displayName ?? "",
              country,
              phone: status.phone ?? "",
              baseCurrency: currency,
            });
          } else {
            // Signed in but no profile fields yet — Tier 1 (social only).
            advanceTo(1);
          }
        } catch (err) {
          console.error("[AuthSeeder] status fetch failed", err);
        }
      } catch (err) {
        console.error("[AuthSeeder] seed failed", err);
        if (!cancelled) {
          seededFor.current = null;
          toast.error("We couldn't finish setting up your account", {
            description:
              "Your sign-in worked, but profile setup didn't complete. Refresh the page or try again in a moment.",
          });
        }
      }
    };

    // Initial session (page load with existing tokens)
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) seed(data.session?.user?.id);
    });

    // Fresh sign-ins only. Skip TOKEN_REFRESHED / INITIAL_SESSION churn.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") seed(session?.user?.id);
      if (event === "SIGNED_OUT") {
        seededFor.current = null;
        setBalances({ USD: 0, NGN: 0, GHS: 0 }, { USD: 0, NGN: 0, GHS: 0 }, 0);
      }
    });

    // Subscribe to wallet balance changes for the signed-in user.
    let walletChannel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || cancelled) return;
      walletChannel = supabase
        .channel(`wallets-root-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` },
          () => void refreshBalances(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (walletChannel) supabase.removeChannel(walletChannel);
    };
  }, [seedNewUser, fetchBalances, fetchStatus, setBalances, advanceTo, setBaseCurrency]);

  return null;
}
