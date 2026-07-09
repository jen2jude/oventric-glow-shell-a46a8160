import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { Mail, ShieldCheck, ArrowRight, Loader2, RotateCw, ArrowLeft, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { seedNewUser as seedNewUserFn } from "@/lib/onboarding.functions";
import { resolveLoginIdentifier as resolveLoginIdentifierFn } from "@/lib/auth-lookup.functions";

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export type AuthGateContextKey =
  | "generic"
  | "buyer"
  | "seller"
  | "solver"
  | "issuer"
  | "funding"
  | "withdraw"
  | "interaction";

const COPY: Record<AuthGateContextKey, { title: string; subtitle: string }> = {
  generic: {
    title: "Connect your account",
    subtitle: "Sign in with a 6-digit email code to unlock this action.",
  },
  buyer: {
    title: "Secure your access",
    subtitle:
      "Verify your profile in 10 seconds to purchase this digital asset and download files.",
  },
  seller: {
    title: "Claim your storefront",
    subtitle:
      "Authenticate your email to set up your creator profile and list files for sale.",
  },
  solver: {
    title: "Unlock freelance workspaces",
    subtitle:
      "Verify your profile to place a bid on this bounty and secure your escrow payout rules.",
  },
  issuer: {
    title: "Find elite talent",
    subtitle:
      "Sign up instantly to fund your escrow vault and publish your project on the global board.",
  },
  funding: {
    title: "Initialize banking ledger",
    subtitle:
      "Verify your account securely to process card, bank, or MoMo ingestion deposits.",
  },
  withdraw: {
    title: "Secure currency clearance",
    subtitle:
      "Verify your identity profile to authorize capital withdrawals to your localized banking networks.",
  },
  interaction: {
    title: "Join the conversation",
    subtitle:
      "Input your email to drop a technical review, provide code feedback, or upvote your peers.",
  },
};

interface AuthGateContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  checked: boolean;
  ensureUserAuthenticated: (
    actionCallback: () => void | Promise<void>,
    contextType?: AuthGateContextKey,
  ) => void;
  openGate: (contextType?: AuthGateContextKey) => void;
  closeGate: () => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used inside <AuthGateProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [ctxKey, setCtxKey] = useState<AuthGateContextKey>("generic");
  const [splash, setSplash] = useState(false);
  const pendingRef = useRef<null | (() => void | Promise<void>)>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "INITIAL_SESSION"
      ) return;
      setSession(next);
      setChecked(true);
      if (event === "SIGNED_IN" && next) {
        // Fire the RGB neon success splash, then close the modal + run the
        // pending action once the animation has had time to play.
        setSplash(true);
        setGateOpen(false);
        const cb = pendingRef.current;
        pendingRef.current = null;
        window.setTimeout(() => {
          setSplash(false);
          if (cb) void cb();
        }, 1400);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuthenticated = !!session;

  const ensureUserAuthenticated = useCallback(
    (actionCallback: () => void | Promise<void>, contextType: AuthGateContextKey = "generic") => {
      if (session) {
        void actionCallback();
        return;
      }
      pendingRef.current = actionCallback;
      setCtxKey(contextType);
      setGateOpen(true);
    },
    [session],
  );

  const openGate = useCallback((contextType: AuthGateContextKey = "generic") => {
    setCtxKey(contextType);
    setGateOpen(true);
  }, []);

  const closeGate = useCallback(() => {
    pendingRef.current = null;
    setGateOpen(false);
  }, []);

  const value = useMemo<AuthGateContextValue>(
    () => ({ isAuthenticated, session, checked, ensureUserAuthenticated, openGate, closeGate }),
    [isAuthenticated, session, checked, ensureUserAuthenticated, openGate, closeGate],
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      {gateOpen && (
        <AuthGateModal
          contextKey={ctxKey}
          onClose={closeGate}
        />
      )}
      {splash && <NeonSuccessSplash />}
    </AuthGateContext.Provider>
  );
}

function NeonSuccessSplash() {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Successfully signed in"
    >
      <div className="absolute inset-0 rgb-neon-bg opacity-70" style={{ animation: "auth-flash 1.4s ease-out forwards" }} />
      <div className="relative z-10 rgb-neon-bg rounded-2xl p-[2px]">
        <div className="bg-[#0b0b0d] rounded-2xl px-8 py-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full rgb-pulse-glow bg-[#121214] border border-white/10 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-300" aria-hidden />
          </div>
          <div className="text-white font-black tracking-tight text-lg">Verified</div>
          <div className="text-[12px] text-slate-400 mt-1">Welcome to Oventric.</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Modal — the shared OTP flow, portalled at z-[200]
// ---------------------------------------------------------------------------

const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter a valid email")
  .max(254, "Email is too long")
  .email("Enter a valid email");

const usernameSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(24, "Username must be under 24 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/u, "Letters, numbers, . _ - only");

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

type Stage = "email" | "otp";
type Mode = "new" | "returning";

function AuthGateModal({
  contextKey,
  onClose,
}: {
  contextKey: AuthGateContextKey;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("new");
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState(""); // returning user: email or username
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const seedNewUser = useServerFn(seedNewUserFn);
  const resolveLoginIdentifier = useServerFn(resolveLoginIdentifierFn);

  const humanizeError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("token has expired") || m.includes("expired")) return "That code expired. Tap Resend to get a fresh one.";
    if (m.includes("invalid") && m.includes("token")) return "That code isn't right. Double-check the 6 digits from your inbox.";
    if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a moment before trying again.";
    if (m.includes("network") || m.includes("fetch")) return "Network hiccup. Check your connection and retry.";
    return msg;
  };

  const copy = COPY[contextKey] ?? COPY.generic;

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (stage === "otp") {
      const t = window.setTimeout(() => otpRefs.current[0]?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [stage]);

  // Lock body scroll while gate is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !verifying && !verified) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [verifying, onClose]);

  const sendCode = useCallback(async () => {
    setEmailError(null);
    setUsernameError(null);
    setFlash(null);
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setEmailError(parsedEmail.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    if (username.trim()) {
      const parsedUser = usernameSchema.safeParse(username);
      if (!parsedUser.success) {
        setUsernameError(parsedUser.error.issues[0]?.message ?? "Invalid username");
        return;
      }
    }
    setSending(true);
    try {
      // Omit emailRedirectTo so the email is a pure 6-digit code, not a
      // clickable magic link — users always paste the code in the modal.
      const { error } = await supabase.auth.signInWithOtp({
        email: parsedEmail.data,
        options: {
          shouldCreateUser: true,
          data: username.trim() ? { username: username.trim() } : undefined,
        },
      });
      if (error) throw error;
      setStage("otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendIn(RESEND_SECONDS);
      setFlash(`Code sent to ${parsedEmail.data}`);
    } catch (err) {
      setEmailError(humanizeError(err instanceof Error ? err.message : "Could not send code"));
    } finally {
      setSending(false);
    }
  }, [email, username]);

  const sendReturningCode = useCallback(async () => {
    setIdentifierError(null);
    setFlash(null);
    const raw = identifier.trim();
    if (raw.length < 2) {
      setIdentifierError("Enter your email or username");
      return;
    }
    setSending(true);
    try {
      let resolvedEmail = raw;
      if (!raw.includes("@")) {
        const res = await resolveLoginIdentifier({ data: { identifier: raw } });
        resolvedEmail = res.email;
      } else {
        const parsed = emailSchema.safeParse(raw);
        if (!parsed.success) {
          setIdentifierError(parsed.error.issues[0]?.message ?? "Invalid email");
          setSending(false);
          return;
        }
        resolvedEmail = parsed.data;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: resolvedEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("signups not allowed") || msg.includes("not found") || msg.includes("user not found")) {
          throw new Error("No account found. Try signing up as a new user.");
        }
        throw error;
      }
      setEmail(resolvedEmail);
      setStage("otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendIn(RESEND_SECONDS);
      setFlash(`Code sent to ${resolvedEmail}`);
    } catch (err) {
      setIdentifierError(humanizeError(err instanceof Error ? err.message : "Could not send code"));
    } finally {
      setSending(false);
    }
  }, [identifier, resolveLoginIdentifier]);


  const verifyCode = useCallback(
    async (token: string) => {
      setOtpError(null);
      if (token.length !== OTP_LENGTH) return;
      setVerifying(true);
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token,
          type: "email",
        });
        if (error) throw error;
        if (!data.session) throw new Error("Verification succeeded but no session was returned");
        setVerified(true);
        setFlash(null);
        try {
          await seedNewUser({ data: username.trim() ? { username: username.trim() } : {} });
        } catch (seedErr) {
          console.error("[AuthGate] seed failed", seedErr);
        }
        // The provider's onAuthStateChange('SIGNED_IN') closes the modal and
        // runs the pending action. Nothing else to do here.
      } catch (err) {
        setOtpError(humanizeError(err instanceof Error ? err.message : "Invalid or expired code"));
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        window.setTimeout(() => otpRefs.current[0]?.focus(), 40);
      } finally {
        setVerifying(false);
      }
    },
    [email, seedNewUser, username],
  );

  const setDigit = (idx: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setOtpDigits((prev) => { const n = [...prev]; n[idx] = ""; return n; });
      return;
    }
    if (clean.length > 1) {
      const chars = clean.slice(0, OTP_LENGTH - idx).split("");
      setOtpDigits((prev) => {
        const n = [...prev];
        chars.forEach((c, i) => { n[idx + i] = c; });
        return n;
      });
      const nextFocus = Math.min(idx + chars.length, OTP_LENGTH - 1);
      window.setTimeout(() => otpRefs.current[nextFocus]?.focus(), 0);
      const combined = [...otpDigits];
      chars.forEach((c, i) => { combined[idx + i] = c; });
      const full = combined.join("");
      if (full.length === OTP_LENGTH && !full.includes("")) void verifyCode(full);
      return;
    }
    setOtpDigits((prev) => { const n = [...prev]; n[idx] = clean; return n; });
    if (idx < OTP_LENGTH - 1) {
      window.setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0);
    }
    const combined = [...otpDigits];
    combined[idx] = clean;
    const full = combined.join("");
    if (full.length === OTP_LENGTH && !full.includes("")) void verifyCode(full);
  };

  const onKeyDownDigit = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      e.preventDefault();
      setOtpDigits((prev) => { const n = [...prev]; n[idx - 1] = ""; return n; });
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    } else if (e.key === "Enter") {
      const full = otpDigits.join("");
      if (full.length === OTP_LENGTH) void verifyCode(full);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={(e) => { if (e.target === e.currentTarget && !verifying && !verified) onClose(); }}
    >
      <div className="relative w-full max-w-md">
        <div className="rgb-neon-bg rounded-2xl p-[1.5px]">
          <div className="bg-[#1E1E24] rounded-2xl p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying || verified}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <header className="text-center mb-6">
              <div className="mx-auto w-12 h-12 rounded-xl rgb-pulse-glow bg-[#121214] border border-white/10 flex items-center justify-center mb-3">
                {stage === "email" ? (
                  <Mail className="w-5 h-5 text-emerald-300" aria-hidden />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-300" aria-hidden />
                )}
              </div>
              <h1 className="text-white font-black text-xl tracking-tight">
                {stage === "email" ? copy.title : "Verify your email"}
              </h1>
              <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
                {stage === "email"
                  ? copy.subtitle
                  : `Enter the 6-digit code sent to ${email || "your inbox"}.`}
              </p>
            </header>

            {stage === "email" ? (
              <form
                onSubmit={(e) => { e.preventDefault(); void sendCode(); }}
                noValidate
                className="space-y-4"
              >
                <div>
                  <label htmlFor="gate-email" className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="gate-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                    placeholder="you@builder.io"
                    aria-invalid={!!emailError}
                    className={`w-full min-h-11 bg-[#121214] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 border ${
                      emailError ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
                    }`}
                  />
                  {emailError && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="gate-username" className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Username <span className="text-slate-600 font-normal normal-case">(optional — new accounts only)</span>
                  </label>
                  <input
                    id="gate-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setUsernameError(null); }}
                    placeholder="sovereign_architect"
                    aria-invalid={!!usernameError}
                    className={`w-full min-h-11 bg-[#121214] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 border ${
                      usernameError ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
                    }`}
                  />
                  {usernameError && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                      {usernameError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="rgb-pulse-glow w-full min-h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <>Send Verification Code <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={i === 0 ? OTP_LENGTH : 1}
                      value={d}
                      aria-label={`Digit ${i + 1}`}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => onKeyDownDigit(i, e)}
                      onFocus={(e) => e.currentTarget.select()}
                      disabled={verifying || verified}
                      className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black tabular-nums text-white bg-[#121214] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/60 border transition-colors ${
                        verified
                          ? "border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                          : otpError
                            ? "border-red-500/70"
                            : "border-white/10 focus:border-emerald-500/60"
                      }`}
                    />
                  ))}
                </div>

                {verified ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-[12px] text-emerald-300 inline-flex items-center gap-2 w-full"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">Code verified. Signing you in…</span>
                  </div>
                ) : otpError ? (
                  <p role="alert" className="text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                    {otpError}
                  </p>
                ) : verifying ? (
                  <p className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verifying…
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void verifyCode(otpDigits.join(""))}
                  disabled={verifying || verified || otpDigits.join("").length !== OTP_LENGTH}
                  className="rgb-pulse-glow w-full min-h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {verifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  ) : verified ? (
                    <><ShieldCheck className="w-4 h-4 text-emerald-300" /> Verified</>
                  ) : (
                    <>Submit Code <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <div className="flex items-center justify-between text-[12px]">
                  <button
                    type="button"
                    onClick={() => { setStage("email"); setOtpError(null); setFlash(null); }}
                    disabled={verifying || verified}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white min-h-11 px-1 disabled:opacity-40"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (resendIn === 0) void sendCode(); }}
                    disabled={resendIn > 0 || sending || verifying || verified}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200 disabled:text-slate-500 min-h-11 px-1"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${sending ? "animate-spin" : ""}`} />
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend Code"}
                  </button>
                </div>
              </div>
            )}

            {flash && stage === "otp" && !verified && (
              <p className="mt-4 text-[11px] text-emerald-400 text-center">{flash}</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
