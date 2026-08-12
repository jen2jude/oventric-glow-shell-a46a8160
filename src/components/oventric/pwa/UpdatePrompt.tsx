import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  applyServiceWorkerUpdate,
  checkForUpdateNow,
  onServiceWorkerUpdate,
} from "@/lib/pwa/register-sw";

/**
 * Shown when a newer build of the app has been downloaded by the service
 * worker and is waiting to take over. Tapping "Update now" activates the new
 * worker and reloads into the fresh version.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => onServiceWorkerUpdate(setReady), []);

  const updateNow = () => {
    haptic("medium");
    setBusy(true);
    applyServiceWorkerUpdate();
  };

  const checkNow = async () => {
    haptic("light");
    setChecking(true);
    const found = await checkForUpdateNow();
    if (!found) {
      // No update waiting yet — just reload to ensure latest version.
      window.location.reload();
    }
    setChecking(false);
  };

  if (!ready || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 z-[80] mx-auto max-w-md rounded-[10px] border border-emerald-500/30 bg-[#1E1E24] p-3 text-slate-200 shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:w-96"
      style={{ bottom: "calc(5.5rem + max(env(safe-area-inset-bottom), 0.5rem))" }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-emerald-500/15 text-emerald-400">
          <RefreshCw className={busy || checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">A new version is ready</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Tap Update now to get the latest features and fixes immediately.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={updateNow}
              disabled={busy || checking}
              className="rounded-[10px] bg-emerald-500 px-3 py-3 text-xs font-bold text-[#08130f] active:scale-[.98] disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update now"}
            </button>
            <button
              onClick={checkNow}
              disabled={busy || checking}
              className="rounded-[10px] px-3 py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-60"
            >
              {checking ? "Checking…" : "Check again"}
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notice"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-slate-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
