import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthPanel } from "@/components/oventric/AuthPanel";

/**
 * App-wide auth gate. Renders <AuthPanel /> in place of children whenever there
 * is no Supabase session, and swaps in the app shell as soon as a session
 * arrives (via signInWithOtp / verifyOtp).
 *
 * The gate is inline — the URL stays intact so deep links survive login.
 * Supabase persists sessions in localStorage by default, so refreshes never
 * re-prompt.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION") {
        return;
      }
      setSession(next);
      setChecked(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!checked) {
    // Brief pre-hydration state — avoids flashing the auth panel to a
    // signed-in user during the initial session check.
    return (
      <div className="min-h-dvh w-full bg-[#121214] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full rgb-pulse-glow bg-[#1E1E24] border border-white/10" aria-label="Loading" />
      </div>
    );
  }

  if (!session) {
    return <AuthPanel />;
  }

  return <>{children}</>;
}
