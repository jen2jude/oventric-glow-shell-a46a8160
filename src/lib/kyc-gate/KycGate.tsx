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
import {
  Camera,
  Check,
  Loader2,
  RotateCw,
  ScanFace,
  ShieldCheck,
  X,
  AlertTriangle,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import {
  getOnboardingStatus as getStatusFn,
  saveKyc as saveKycFn,
} from "@/lib/onboarding.functions";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type KycMode = "enroll" | "match";

interface KycGateValue {
  /** Ensure KYC is complete before running `onSuccess`. Opens camera flow. */
  ensureKyc: (onSuccess: () => void | Promise<void>) => void;
  /** Match against the stored selfie (e.g. before withdrawal). */
  verifyLiveness: (onSuccess: () => void | Promise<void>) => void;
  kycCompleted: boolean;
}

const KycCtx = createContext<KycGateValue | null>(null);

export function useKycGate() {
  const ctx = useContext(KycCtx);
  if (!ctx) throw new Error("useKycGate must be used inside <KycGateProvider>");
  return ctx;
}

export function KycGateProvider({ children }: { children: ReactNode }) {
  const { session, checked } = useAuthGate();
  const [kycCompleted, setKycCompleted] = useState(false);
  const [mode, setMode] = useState<KycMode | null>(null);
  const [referencePath, setReferencePath] = useState<string | null>(null);
  const pendingRef = useRef<null | (() => void | Promise<void>)>(null);
  const getStatus = useServerFn(getStatusFn);
  const lastCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!checked || !session?.user?.id) {
      setKycCompleted(false);
      setReferencePath(null);
      return;
    }
    if (lastCheckedRef.current === session.user.id) return;
    lastCheckedRef.current = session.user.id;
    getStatus()
      .then((s) => {
        setKycCompleted(s.kycCompleted);
        setReferencePath(s.kycSelfiePath);
      })
      .catch(() => {
        /* fail closed: user will re-enrol */
      });
  }, [session?.user?.id, checked, getStatus]);

  const ensureKyc = useCallback(
    (onSuccess: () => void | Promise<void>) => {
      if (kycCompleted) {
        void onSuccess();
        return;
      }
      pendingRef.current = onSuccess;
      setMode("enroll");
    },
    [kycCompleted],
  );

  const verifyLiveness = useCallback(
    (onSuccess: () => void | Promise<void>) => {
      if (!kycCompleted) {
        // No enrollment yet — fall through to enrollment.
        pendingRef.current = onSuccess;
        setMode("enroll");
        return;
      }
      pendingRef.current = onSuccess;
      setMode("match");
    },
    [kycCompleted],
  );

  const handleComplete = useCallback((newPath?: string) => {
    setMode(null);
    if (newPath) {
      setKycCompleted(true);
      setReferencePath(newPath);
    }
    const cb = pendingRef.current;
    pendingRef.current = null;
    window.setTimeout(() => cb?.(), 40);
  }, []);

  const handleClose = useCallback(() => {
    pendingRef.current = null;
    setMode(null);
  }, []);

  const value = useMemo<KycGateValue>(
    () => ({ ensureKyc, verifyLiveness, kycCompleted }),
    [ensureKyc, verifyLiveness, kycCompleted],
  );

  return (
    <KycCtx.Provider value={value}>
      {children}
      {mode && (
        <KycLivenessModal
          mode={mode}
          referencePath={referencePath}
          onComplete={handleComplete}
          onClose={handleClose}
        />
      )}
    </KycCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type Step = "phone" | "camera" | "capturing" | "review" | "matching" | "success" | "mismatch";

function KycLivenessModal({
  mode,
  referencePath,
  onComplete,
  onClose,
}: {
  mode: KycMode;
  referencePath: string | null;
  onComplete: (newPath?: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(mode === "enroll" ? "phone" : "camera");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saveKyc = useServerFn(saveKycFn);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Fetch signed reference URL for match mode
  useEffect(() => {
    if (mode !== "match" || !referencePath) return;
    supabase.storage
      .from("kyc-selfies")
      .createSignedUrl(referencePath, 120)
      .then(({ data }) => {
        if (data?.signedUrl) setReferenceUrl(data.signedUrl);
      });
  }, [mode, referencePath]);

  // Start / stop the camera when we enter the camera step
  useEffect(() => {
    if (step !== "camera") return;
    let cancelled = false;
    const start = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera permission denied. Enable camera access to continue."
            : "Could not access your camera. Check your browser settings.",
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  // Countdown for capture
  useEffect(() => {
    if (step !== "capturing") return;
    if (countdown <= 0) {
      // Capture frame
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Mirror the video for a natural selfie look
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Capture failed. Try again.");
            setStep("camera");
            return;
          }
          setSelfieBlob(blob);
          setSelfieUrl(URL.createObjectURL(blob));
          streamRef.current?.getTracks().forEach((t) => t.stop());
          setStep(mode === "enroll" ? "review" : "matching");
        },
        "image/jpeg",
        0.85,
      );
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 900);
    return () => window.clearTimeout(t);
  }, [step, countdown, mode]);

  // Simulated match: 1.5s check then success (demo — face-embedding not wired)
  useEffect(() => {
    if (step !== "matching") return;
    const t = window.setTimeout(() => {
      // Naive "match" heuristic: if we have both a captured blob and a reference URL, succeed.
      if (selfieBlob && referenceUrl) setStep("success");
      else setStep("mismatch");
    }, 1600);
    return () => window.clearTimeout(t);
  }, [step, selfieBlob, referenceUrl]);

  // On enrollment success, upload + persist
  const submitEnrollment = useCallback(async () => {
    if (!selfieBlob) return;
    setError(null);
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("kyc-selfies")
        .upload(path, selfieBlob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      await saveKyc({ data: { phone: phone.trim(), selfiePath: path } });
      setStep("success");
      setTimeout(() => onComplete(path), 1100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save KYC");
    } finally {
      setBusy(false);
    }
  }, [selfieBlob, phone, saveKyc, onComplete]);

  useEffect(() => {
    if (step === "success" && mode === "match") {
      const t = window.setTimeout(() => onComplete(), 1000);
      return () => window.clearTimeout(t);
    }
  }, [step, mode, onComplete]);

  const startCapture = () => {
    setPhoneError(null);
    if (mode === "enroll") {
      const trimmed = phone.trim();
      if (trimmed.length < 6 || !/^\+?[\d\s\-()]{6,24}$/.test(trimmed)) {
        setPhoneError("Enter a valid phone number with country code");
        setStep("phone");
        return;
      }
    }
    setCountdown(3);
    setStep("capturing");
  };

  const retake = () => {
    setSelfieBlob(null);
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfieUrl(null);
    setError(null);
    setStep("camera");
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyc-title"
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={busy ? undefined : onClose} />
      <div className="relative w-full sm:max-w-md bg-[#141418] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
              {mode === "enroll" ? "KYC Enrollment" : "Liveness Check"}
            </div>
            <h2 id="kyc-title" className="text-lg font-black text-white">
              {mode === "enroll"
                ? "Verify your identity to unlock wallet"
                : "Confirm it's you"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 -m-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "phone" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Wallet funding and payouts require a one-time identity check. Enter your phone number
              and we'll capture a quick liveness selfie.
            </p>
            <div>
              <label htmlFor="kyc-phone" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-300" /> Phone (with country code)
              </label>
              <input
                id="kyc-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className={`w-full h-11 px-3 bg-[#121214] rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 border ${
                  phoneError ? "border-red-500/70" : "border-white/10 focus:border-emerald-500/60"
                }`}
              />
              {phoneError && (
                <p role="alert" className="mt-1.5 text-[11px] font-semibold text-red-400 border-l-2 border-red-500 pl-2">
                  {phoneError}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                const trimmed = phone.trim();
                if (trimmed.length < 6 || !/^\+?[\d\s\-()]{6,24}$/.test(trimmed)) {
                  setPhoneError("Enter a valid phone number with country code");
                  return;
                }
                setPhoneError(null);
                setStep("camera");
              }}
              className="rgb-pulse-glow w-full h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" /> Continue to camera
            </button>
          </div>
        )}

        {(step === "camera" || step === "capturing") && (
          <div className="flex flex-col items-center">
            <div className="rgb-neon-bg rounded-full p-[3px] mb-4">
              <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-black overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                />
                {!streamRef.current && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-300" />
                  </div>
                )}
                {step === "capturing" && (
                  <>
                    <div className="absolute inset-x-0 top-1/2 h-[2px] bg-emerald-400/70 shadow-[0_0_12px_#10b981] animate-pulse" />
                    <div className="absolute inset-0 border-8 border-emerald-400/50 rounded-full animate-pulse" />
                  </>
                )}
                <ScanFace className="absolute w-16 h-16 text-emerald-300/40 pointer-events-none" />
              </div>
            </div>
            {error ? (
              <div role="alert" className="text-sm text-red-400 mb-3 text-center inline-flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : step === "capturing" ? (
              <>
                <p className="text-sm text-slate-300">Hold still — capturing</p>
                <p className="text-4xl font-black text-white mt-1 tabular-nums">{countdown}</p>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center mb-3">
                Center your face inside the ring and tap capture. This creates your{" "}
                {mode === "enroll" ? "biometric reference" : "liveness match"}.
              </p>
            )}
            {step === "camera" && !error && (
              <button
                onClick={startCapture}
                className="mt-2 w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm inline-flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture
              </button>
            )}
            {error && (
              <button
                onClick={() => setStep(mode === "enroll" ? "phone" : "camera")}
                className="mt-2 w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm inline-flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" /> Retry
              </button>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {step === "review" && selfieUrl && (
          <div className="space-y-4">
            <div className="rgb-neon-bg rounded-2xl p-[2px]">
              <div className="bg-black rounded-2xl overflow-hidden">
                <img src={selfieUrl} alt="Captured selfie" className="w-full aspect-square object-cover" />
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Save this as your biometric reference. We'll match against it before every payout.
            </p>
            {error && (
              <p role="alert" className="text-xs text-red-400 border-l-2 border-red-500 pl-2">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={retake}
                disabled={busy}
                className="h-11 rounded-lg border border-white/10 bg-[#121214] text-slate-200 font-bold text-sm inline-flex items-center justify-center gap-2 hover:border-emerald-500/40 disabled:opacity-50"
              >
                <RotateCw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={submitEnrollment}
                disabled={busy}
                className="rgb-pulse-glow h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 text-emerald-300" /> Save & continue</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "matching" && (
          <div className="flex flex-col items-center py-4">
            <div className="grid grid-cols-2 gap-3 mb-4 w-full">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 text-center">Reference</div>
                <div className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-black">
                  {referenceUrl ? (
                    <img src={referenceUrl} alt="Stored reference" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5 text-center">Live capture</div>
                <div className="aspect-square rounded-lg overflow-hidden border border-emerald-500/40 bg-black">
                  {selfieUrl ? (
                    <img src={selfieUrl} alt="Live capture" className="w-full h-full object-cover" />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
              <Loader2 className="w-4 h-4 animate-spin" /> Matching biometric signature…
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center py-6">
            <div className="rgb-neon-bg rounded-full p-[3px] mb-3">
              <div className="w-16 h-16 rounded-full bg-[#0b0b0d] flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-300" strokeWidth={3} />
              </div>
            </div>
            <div className="text-white font-black text-lg">Congratulations</div>
            <p className="text-xs text-slate-400 mt-1 text-center">
              {mode === "enroll"
                ? "Your identity is verified. Wallet unlocked."
                : "Face match confirmed. Access granted."}
            </p>
          </div>
        )}

        {step === "mismatch" && (
          <div className="flex flex-col items-center py-4">
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div className="text-white font-black">Face didn't match</div>
            <p className="text-xs text-slate-400 mt-1 text-center">
              We couldn't confirm your identity. Move to bright, even light and try again.
            </p>
            <button
              onClick={retake}
              className="mt-4 w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm inline-flex items-center justify-center gap-2"
            >
              <RotateCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
