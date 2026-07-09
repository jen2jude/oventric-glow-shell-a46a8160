import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { seedNewUser as seedNewUserFn } from "@/lib/onboarding.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

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
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const seed = async (userId: string | undefined) => {
      if (!userId || seededFor.current === userId) return;
      seededFor.current = userId;
      try {
        await seedNewUser({ data: {} });
      } catch (err) {
        // Non-blocking: seeding is idempotent and can retry next session.
        console.error("[AuthSeeder] seed failed", err);
        if (!cancelled) seededFor.current = null;
      }
    };

    // Initial session (page load with existing tokens)
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) seed(data.session?.user?.id);
    });

    // Fresh sign-ins only. Skip TOKEN_REFRESHED / INITIAL_SESSION churn.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") seed(session?.user?.id);
      if (event === "SIGNED_OUT") seededFor.current = null;
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [seedNewUser]);

  return null;
}
