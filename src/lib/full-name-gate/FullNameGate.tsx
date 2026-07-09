import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserRound, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { updateFullName as updateFullNameFn } from "@/lib/onboarding.functions";

const STORAGE_KEY = "oventric.fullName";

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your full name")
  .max(80, "That name is too long")
  .regex(/\s/, "Enter first and last name");

interface FullNameGateValue {
  ensureFullName: (onSuccess: () => void | Promise<void>) => void;
  currentFullName: string | null;
}

const Ctx = createContext<FullNameGateValue | null>(null);

export function useFullNameGate() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFullNameGate must be used inside <FullNameGateProvider>");
  return ctx;
}

function readStored(userId: string | null): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    return window.localStorage.getItem(`${STORAGE_KEY}.${userId}`);
  } catch {
    return null;
  }
}

function writeStored(userId: string, value: string) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}.${userId}`, value);
  } catch {
    /* noop */
  }
}

export function FullNameGateProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthGate();
  const { fullName, advanceTo, tier } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<string | null>(null);
  const pendingRef = useRef<null | (() => void | Promise<void>)>(null);

  const userId = session?.user?.id ?? null;

  // Hydrate stored value whenever the session changes
  useEffect(() => {
    setStored(readStored(userId));
  }, [userId]);

  const currentFullName = fullName?.trim() || stored;

  const ensureFullName = useCallback(
    (onSuccess: () => void | Promise<void>) => {
      const existing = (fullName?.trim() || readStored(userId) || "").trim();
      if (existing.length >= 2) {
        void onSuccess();
        return;
      }
      pendingRef.current = onSuccess;
      setOpen(true);
    },
    [fullName, userId],
  );

  const handleSaved = useCallback(
    (name: string) => {
      if (userId) writeStored(userId, name);
      setStored(name);
      // Persist into the onboarding context so downstream flows (KYC, wallet)
      // see the same value. Preserve current tier — don't accidentally advance.
      const t = tier < 2 ? tier : tier;
      advanceTo(t, { fullName: name });
      setOpen(false);
      const cb = pendingRef.current;
      pendingRef.current = null;
      window.setTimeout(() => cb?.(), 40);
    },
    [advanceTo, tier, userId],
  );

  const handleClose = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const value = useMemo<FullNameGateValue>(
    () => ({ ensureFullName, currentFullName }),
    [ensureFullName, currentFullName],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {open && <FullNameModal onClose={handleClose} onSaved={handleSaved} defaultValue={currentFullName ?? ""} />}
    </Ctx.Provider>
  );
}

function FullNameModal({
  onClose,
  onSaved,
  defaultValue,
}: {
  onClose: () => void;
  onSaved: (fullName: string) => void;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const updateFullName = useServerFn(updateFullNameFn);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = useCallback(async () => {
    setError(null);
    const parsed = fullNameSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    setSaving(true);
    try {
      // If authenticated, persist to profile. Silently ignore auth errors so
      // guests (should not normally reach here) still get a local record.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await updateFullName({ data: { fullName: parsed.data } });
      }
      onSaved(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your name");
    } finally {
      setSaving(false);
    }
  }, [onSaved, updateFullName, value]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center sm:items-center px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullname-title"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={saving ? undefined : onClose} />
      <div className="slide-up relative w-full max-w-md bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="fullname-title" className="text-lg font-bold text-white">
              What's your full name?
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              We use this on your posts, listings, bounties, and payout receipts. You'll only need to do this once.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 -m-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
          <UserRound className="w-6 h-6 text-emerald-400" />
        </div>

        <label htmlFor="fullname-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Full Name
        </label>
        <input
          id="fullname-input"
          ref={inputRef}
          type="text"
          autoComplete="name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving) submit();
          }}
          disabled={saving}
          placeholder="Ada Lovelace"
          className={`w-full h-11 px-3 bg-[#121214] border rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
            error
              ? "border-red-500/60 focus:border-red-400 focus:ring-red-500/20"
              : "border-white/10 focus:border-emerald-500/60 focus:ring-emerald-500/20"
          }`}
          aria-invalid={!!error}
          aria-describedby={error ? "fullname-error" : undefined}
        />
        {error && (
          <p id="fullname-error" role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full h-11 mt-5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save & continue"
          )}
        </button>
      </div>
    </div>,
    document.body,
  );
}
