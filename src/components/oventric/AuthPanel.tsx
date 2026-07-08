import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, ShieldCheck, ArrowRight, Loader2, RotateCw, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { seedNewUser as seedNewUserFn } from "@/lib/onboarding.functions";

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

export function AuthPanel() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const seedNewUser = useServerFn(seedNewUserFn);

  // Countdown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  // Autofocus first OTP box when stage flips
  useEffect(() => {
    if (stage === "otp") {
      const t = window.setTimeout(() => otpRefs.current[0]?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [stage]);

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
      const { error } = await supabase.auth.signInWithOtp({
        email: parsedEmail.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          data: username.trim() ? { username: username.trim() } : undefined,
        },
      });
      if (error) throw error;
      setStage("otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendIn(RESEND_SECONDS);
      setFlash(`Code sent to ${parsedEmail.data}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send code";
      setEmailError(msg);
    } finally {
      setSending(false);
    }
  }, [email, username]);

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

        // Seed profile + wallets with the chosen username (best-effort, non-blocking).
        try {
          await seedNewUser({ data: username.trim() ? { username: username.trim() } : {} });
        } catch (seedErr) {
          console.error("[AuthPanel] seed failed", seedErr);
        }

        // Trigger the immersive rgb-neon transition, then let the root gate
        // swap in the app shell on the next paint.
        if (typeof document !== "undefined") {
          const flashEl = document.createElement("div");
          flashEl.className = "fixed inset-0 z-[200] rgb-neon-bg pointer-events-none";
          flashEl.style.animation = "auth-flash 900ms ease-out forwards";
          document.body.appendChild(flashEl);
          window.setTimeout(() => flashEl.remove(), 950);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid or expired code";
        setOtpError(msg);
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
      // Deletion path
      setOtpDigits((prev) => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
      return;
    }
    if (clean.length > 1) {
      // Paste-style input — spread across boxes
      const chars = clean.slice(0, OTP_LENGTH - idx).split("");
      setOtpDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, i) => {
          next[idx + i] = c;
        });
        return next;
      });
      const nextFocus = Math.min(idx + chars.length, OTP_LENGTH - 1);
      window.setTimeout(() => otpRefs.current[nextFocus]?.focus(), 0);
      const combined = [...otpDigits];
      chars.forEach((c, i) => {
        combined[idx + i] = c;
      });
      const full = combined.join("");
      if (full.length === OTP_LENGTH && !full.includes("")) void verifyCode(full);
      return;
    }
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });
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
      setOtpDigits((prev) => {
        const next = [...prev];
        next[idx - 1] = "";
        return next;
      });
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

  return (
    <div className="relative min-h-dvh w-full bg-[#121214] text-slate-200 flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* Ambient neon frame */}
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-40 rgb-neon-bg" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-40 rgb-neon-bg" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-40 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-40 rgb-neon-bg hidden md:block" />

      <div className="relative w-full max-w-md">
        <div className="rgb-neon-bg rounded-2xl p-[1.5px]">
          <div className="bg-[#1E1E24] rounded-2xl p-6 sm:p-8">
            <header className="text-center mb-6">
              <div className="mx-auto w-12 h-12 rounded-xl rgb-pulse-glow bg-[#121214] border border-white/10 flex items-center justify-center mb-3">
                {stage === "email" ? (
                  <Mail className="w-5 h-5 text-emerald-300" aria-hidden />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-300" aria-hidden />
                )}
              </div>
              <h1 className="text-white font-black text-xl tracking-tight">
                {stage === "email" ? "Enter the platform" : "Verify your email"}
              </h1>
              <p className="text-[12px] text-slate-500 mt-1">
                {stage === "email"
                  ? "We'll email a 6-digit code to sign you in or create your account."
                  : `Enter the 6-digit code sent to ${email || "your inbox"}.`}
              </p>
            </header>

            {stage === "email" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendCode();
                }}
                noValidate
                className="space-y-4"
              >
                <div>
                  <label htmlFor="auth-email" className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                    placeholder="you@builder.io"
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "auth-email-error" : undefined}
                    className={`w-full min-h-11 bg-[#121214] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 border ${
                      emailError ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
                    }`}
                  />
                  {emailError && (
                    <p id="auth-email-error" className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="auth-username" className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Username <span className="text-slate-600 font-normal normal-case">(optional — new accounts only)</span>
                  </label>
                  <input
                    id="auth-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setUsernameError(null); }}
                    placeholder="sovereign_architect"
                    aria-invalid={!!usernameError}
                    aria-describedby={usernameError ? "auth-username-error" : undefined}
                    className={`w-full min-h-11 bg-[#121214] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 border ${
                      usernameError ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
                    }`}
                  />
                  {usernameError && (
                    <p id="auth-username-error" className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
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
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      Send Verification Code <ArrowRight className="w-4 h-4" />
                    </>
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
                      disabled={verifying}
                      className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black tabular-nums text-white bg-[#121214] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/60 border ${
                        otpError ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
                      }`}
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                    {otpError}
                  </p>
                )}
                {verifying && (
                  <p className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verifying…
                  </p>
                )}

                <div className="flex items-center justify-between text-[12px]">
                  <button
                    type="button"
                    onClick={() => { setStage("email"); setOtpError(null); setFlash(null); }}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white min-h-11 px-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (resendIn === 0) void sendCode(); }}
                    disabled={resendIn > 0 || sending}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200 disabled:text-slate-500 disabled:hover:text-slate-500 min-h-11 px-1"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${sending ? "animate-spin" : ""}`} />
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend Code"}
                  </button>
                </div>
              </div>
            )}

            {flash && stage === "otp" && (
              <p className="mt-4 text-[11px] text-emerald-400 text-center">{flash}</p>
            )}

            <p className="mt-6 text-center text-[10px] text-slate-600 leading-relaxed">
              By continuing you agree to Oventric's platform terms. Sessions persist
              on this device — you won't need to re-verify on refresh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
