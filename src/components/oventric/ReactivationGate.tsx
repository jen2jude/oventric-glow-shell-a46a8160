import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyDeletionStatus } from "@/lib/profiles.functions";
import { ReactivationModal } from "@/components/oventric/ReactivationModal";

/**
 * Global gate: whenever the user is signed in, check whether their account
 * is scheduled for soft-deletion. If so, prompt to reactivate or sign out.
 * Runs on mount + on every SIGNED_IN event.
 */
export function ReactivationGate() {
  const [status, setStatus] = useState<{ deletedAt: string | null; daysRemaining: number | null }>({
    deletedAt: null,
    daysRemaining: null,
  });
  const check = useServerFn(getMyDeletionStatus);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus({ deletedAt: null, daysRemaining: null });
        return;
      }
      const s = await check();
      setStatus(s);
    } catch {
      /* noop — treat as no pending deletion */
    }
  }, [check]);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") void refresh();
      if (event === "SIGNED_OUT") setStatus({ deletedAt: null, daysRemaining: null });
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStatus({ deletedAt: null, daysRemaining: null });
  }, []);

  const open = !!status.deletedAt;
  if (!open) return null;

  return (
    <ReactivationModal
      open={open}
      daysRemaining={status.daysRemaining ?? 0}
      onReactivated={() => setStatus({ deletedAt: null, daysRemaining: null })}
      onSignOut={signOut}
    />
  );
}
