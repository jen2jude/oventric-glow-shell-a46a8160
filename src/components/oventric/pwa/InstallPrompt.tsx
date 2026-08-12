import { useEffect, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import logoFull from "@/assets/oventric-full-transparent.png";
import { haptic } from "@/lib/haptics";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "oventric:install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Branded "Add to Home Screen" sheet. Uses the native install prompt on
 * Android/Chrome and shows the manual Share → Add to Home Screen steps on iOS.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() < until) return;
    } catch {
      /* ignore */
    }

    const isIos =
      /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      window.setTimeout(() => setOpen(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIos) {
      setIos(true);
      const t = window.setTimeout(() => setOpen(true), 6000);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    haptic("medium");
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:hidden"
      role="dialog"
      aria-label="Install Oventric"
    >
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={dismiss} />
      <div
        className="relative w-full animate-[slide-up_.3s_ease-out] rounded-t-[20px] border-t border-white/10 bg-[#1E1E24] px-5 pt-5 text-slate-200"
        style={{ paddingBottom: "calc(1.25rem + max(env(safe-area-inset-bottom), 0.5rem))" }}
      >
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400"
        >
          <X className="h-4 w-4" />
        </button>

        <img loading="lazy" decoding="async" src={logoFull} alt="Oventric" className="h-7 w-auto" />
        <h2 className="mt-4 text-lg font-bold text-white">Install the Oventric app</h2>
        <p className="mt-1 text-sm text-slate-400">
          Full-screen, faster launches, offline browsing and instant access from your home screen.
        </p>

        {ios ? (
          <ol className="mt-4 space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <Share className="h-4 w-4 text-emerald-400" /> Tap the Share button in Safari
            </li>
            <li className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" /> Choose “Add to Home Screen”
            </li>
          </ol>
        ) : (
          <button
            onClick={install}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-emerald-500 py-3 text-sm font-bold text-[#08130f] active:scale-[.98]"
          >
            <Download className="h-4 w-4" /> Add to home screen
          </button>
        )}

        <button onClick={dismiss} className="mt-3 w-full py-3 text-xs font-semibold text-slate-500">
          Not now
        </button>
      </div>
    </div>
  );
}
