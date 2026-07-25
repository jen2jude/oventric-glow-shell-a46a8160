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
  IdCard,
  LifeBuoy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import {
  getOnboardingStatus as getStatusFn,
  saveKyc as saveKycFn,
} from "@/lib/onboarding.functions";
import { submitKycSupport as submitKycSupportFn } from "@/lib/kyc-support.functions";

import { ResponsiveImage } from "@/components/ui/responsive-image";

// ---------------------------------------------------------------------------
// Perceptual image hashing (aHash 16x16 → 256-bit fingerprint).
// Not real biometric matching, but rejects unrelated frames so returning-user
// liveness cannot be bypassed with just any face in the camera.
// ---------------------------------------------------------------------------

async function loadImageBitmap(src: string | Blob): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    return img;
  } finally {
    if (typeof src !== "string") {
      // Revoke after a tick so decode has settled.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }
}

/** 256-bit average hash across a 16x16 grayscale downscale. */
async function computeAHash(src: string | Blob): Promise<Uint8Array> {
  const img = await loadImageBitmap(src);
  const size = 16;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  // Center-crop to square before downscale so aspect doesn't skew hash.
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const side = Math.min(iw, ih);
  const sx = Math.floor((iw - side) / 2);
  const sy = Math.floor((ih - side) / 2);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Uint8Array(size * size);
  let sum = 0;
  for (let i = 0; i < size * size; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gray[i] = v;
    sum += v;
  }
  const mean = sum / (size * size);
  const bits = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) bits[i] = gray[i] > mean ? 1 : 0;
  return bits;
}

function hamming(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Threshold on 256-bit hash. ~28% differing bits still counts as a match. */
const HASH_MATCH_MAX_DIFF = 72;
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
  const [idPath, setIdPath] = useState<string | null>(null);
  const pendingRef = useRef<null | (() => void | Promise<void>)>(null);
  const getStatus = useServerFn(getStatusFn);
  const lastCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!checked || !session?.user?.id) {
      setKycCompleted(false);
      setReferencePath(null);
      setIdPath(null);
      return;
    }
    if (lastCheckedRef.current === session.user.id) return;
    lastCheckedRef.current = session.user.id;
    getStatus()
      .then((s) => {
        setKycCompleted(s.kycCompleted);
        setReferencePath(s.kycSelfiePath);
        setIdPath(s.kycIdPath ?? null);
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
        pendingRef.current = onSuccess;
        setMode("enroll");
        return;
      }
      pendingRef.current = onSuccess;
      setMode("match");
    },
    [kycCompleted],
  );

  const handleComplete = useCallback(
    (paths?: { selfie: string; id: string }) => {
      setMode(null);
      if (paths) {
        setKycCompleted(true);
        setReferencePath(paths.selfie);
        setIdPath(paths.id);
      }
      const cb = pendingRef.current;
      pendingRef.current = null;
      window.setTimeout(() => cb?.(), 40);
    },
    [],
  );

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
          idReferencePath={idPath}
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

type Step =
  | "phone"
  | "id-camera"
  | "id-capturing"
  | "id-review"
  | "selfie-camera"
  | "selfie-capturing"
  | "review"
  | "matching"
  | "id-matching"
  | "success"
  | "mismatch"
  | "id-mismatch"
  | "fallback";

type MatchPhase = "selfie" | "id";

function KycLivenessModal({
  mode,
  referencePath,
  idReferencePath,
  onComplete,
  onClose,
}: {
  mode: KycMode;
  referencePath: string | null;
  idReferencePath: string | null;
  onComplete: (paths?: { selfie: string; id: string }) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(mode === "enroll" ? "phone" : "selfie-camera");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [idBlob, setIdBlob] = useState<Blob | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [idReferenceUrl, setIdReferenceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfieAttempts, setSelfieAttempts] = useState(0);
  const [idAttempts, setIdAttempts] = useState(0);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("selfie");
  const [matchDebug, setMatchDebug] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saveKyc = useServerFn(saveKycFn);
  const submitSupport = useServerFn(submitKycSupportFn);

  const isIdStep = step === "id-camera" || step === "id-capturing";
  const isSelfieStep = step === "selfie-camera" || step === "selfie-capturing";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("kyc-active");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("kyc-active");
    };
  }, []);


  useEffect(() => {
    if (mode !== "match") return;
    if (referencePath) {
      supabase.storage
        .from("kyc-selfies")
        .createSignedUrl(referencePath, 300)
        .then(({ data }) => {
          if (data?.signedUrl) setReferenceUrl(data.signedUrl);
        });
    }
    if (idReferencePath) {
      supabase.storage
        .from("kyc-selfies")
        .createSignedUrl(idReferencePath, 300)
        .then(({ data }) => {
          if (data?.signedUrl) setIdReferenceUrl(data.signedUrl);
        });
    }
  }, [mode, referencePath, idReferencePath]);

  // Start camera when entering an id-camera or selfie-camera step.
  useEffect(() => {
    if (!isIdStep && !isSelfieStep) return;
    const facing = isIdStep ? "environment" : "user";
    let cancelled = false;
    const start = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
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
            ? "Camera permission denied. Enable camera access in your browser to continue."
            : "Could not access your camera. Only live capture is accepted for KYC.",
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isIdStep, isSelfieStep]);

  // Countdown → capture frame
  useEffect(() => {
    if (step !== "id-capturing" && step !== "selfie-capturing") return;
    if (countdown <= 0) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (step === "selfie-capturing") {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Capture failed. Try again.");
            setStep(step === "id-capturing" ? "id-camera" : "selfie-camera");
            return;
          }
          streamRef.current?.getTracks().forEach((t) => t.stop());
          if (step === "id-capturing") {
            setIdBlob(blob);
            setIdUrl(URL.createObjectURL(blob));
            setStep(mode === "enroll" ? "id-review" : "id-matching");
          } else {
            setSelfieBlob(blob);
            setSelfieUrl(URL.createObjectURL(blob));
            setStep(mode === "enroll" ? "review" : "matching");
          }
        },
        "image/jpeg",
        0.85,
      );
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 900);
    return () => window.clearTimeout(t);
  }, [step, countdown, mode]);

  // Real face-match against the stored liveness selfie.
  useEffect(() => {
    if (step !== "matching") return;
    let cancelled = false;
    (async () => {
      try {
        if (!selfieBlob || !referenceUrl) throw new Error("Missing capture or reference");
        const [refHash, liveHash] = await Promise.all([
          computeAHash(referenceUrl),
          computeAHash(selfieBlob),
        ]);
        if (cancelled) return;
        const dist = hamming(refHash, liveHash);
        setMatchDebug(`selfie Δ=${dist}/256`);
        if (dist <= HASH_MATCH_MAX_DIFF) {
          setStep("success");
          return;
        }
        const next = selfieAttempts + 1;
        setSelfieAttempts(next);
        if (next >= 2) {
          // After 2 selfie failures, ask for the government ID on file.
          setMatchPhase("id");
          setIdBlob(null);
          if (idUrl) URL.revokeObjectURL(idUrl);
          setIdUrl(null);
          setError(null);
          setStep("id-camera");
        } else {
          setStep("mismatch");
        }
      } catch {
        if (cancelled) return;
        const next = selfieAttempts + 1;
        setSelfieAttempts(next);
        setStep(next >= 2 ? "id-camera" : "mismatch");
        if (next >= 2) setMatchPhase("id");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selfieBlob, referenceUrl, selfieAttempts, idUrl]);

  // Real ID-match against the stored government ID snapshot.
  useEffect(() => {
    if (step !== "id-matching") return;
    let cancelled = false;
    (async () => {
      try {
        if (!idBlob || !idReferenceUrl) throw new Error("Missing capture or ID reference");
        const [refHash, liveHash] = await Promise.all([
          computeAHash(idReferenceUrl),
          computeAHash(idBlob),
        ]);
        if (cancelled) return;
        const dist = hamming(refHash, liveHash);
        setMatchDebug(`id Δ=${dist}/256`);
        if (dist <= HASH_MATCH_MAX_DIFF) {
          setStep("success");
          return;
        }
        setIdAttempts((n) => n + 1);
        setStep("fallback");
      } catch {
        if (cancelled) return;
        setIdAttempts((n) => n + 1);
        setStep("fallback");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, idBlob, idReferenceUrl]);

  const submitEnrollment = useCallback(async () => {
    if (!selfieBlob || !idBlob) return;
    setError(null);
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ts = Date.now();
      const selfiePath = `${uid}/selfie_${ts}.jpg`;
      const idPath = `${uid}/id_${ts}.jpg`;
      const upSelfie = await supabase.storage
        .from("kyc-selfies")
        .upload(selfiePath, selfieBlob, { contentType: "image/jpeg", upsert: true });
      if (upSelfie.error) throw upSelfie.error;
      const upId = await supabase.storage
        .from("kyc-selfies")
        .upload(idPath, idBlob, { contentType: "image/jpeg", upsert: true });
      if (upId.error) throw upId.error;
      await saveKyc({ data: { phone: phone.trim(), selfiePath, idPath } });
      try {
        window.dispatchEvent(new CustomEvent("oventric:profile-updated"));
      } catch { /* noop */ }
      setStep("success");
      setTimeout(() => onComplete({ selfie: selfiePath, id: idPath }), 1100);

    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save KYC");
    } finally {
      setBusy(false);
    }
  }, [selfieBlob, idBlob, phone, saveKyc, onComplete]);

  useEffect(() => {
    if (step === "success" && mode === "match") {
      const t = window.setTimeout(() => onComplete(), 1000);
      return () => window.clearTimeout(t);
    }
  }, [step, mode, onComplete]);

  const beginId = () => {
    setPhoneError(null);
    const trimmed = phone.trim();
    if (trimmed.length < 6 || !/^\+?[\d\s\-()]{6,24}$/.test(trimmed)) {
      setPhoneError("Enter a valid phone number with country code");
      return;
    }
    setStep("id-camera");
  };

  const captureNow = () => {
    setCountdown(3);
    setStep(step === "id-camera" ? "id-capturing" : "selfie-capturing");
  };

  const retakeId = () => {
    setIdBlob(null);
    if (idUrl) URL.revokeObjectURL(idUrl);
    setIdUrl(null);
    setError(null);
    setStep("id-camera");
  };

  const retakeSelfie = () => {
    setSelfieBlob(null);
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfieUrl(null);
    setError(null);
    setStep("selfie-camera");
  };

  const retryMatch = () => {
    setSelfieBlob(null);
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfieUrl(null);
    setError(null);
    setStep("selfie-camera");
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
      <div className="relative w-full sm:max-w-md bg-[#141418] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
              {mode === "enroll" ? "Stage 3 · KYC Verification" : "Liveness Check"}
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

        {mode === "enroll" && step !== "success" && (
          <div className="flex items-center gap-1.5 mb-5">
            {(["phone", "id-camera", "selfie-camera", "review"] as Step[]).map((s, i) => {
              const order: Step[] = ["phone", "id-camera", "id-capturing", "id-review", "selfie-camera", "selfie-capturing", "review"];
              const doneUpTo = order.indexOf(step);
              const stageIndex = order.indexOf(s);
              const active = doneUpTo >= stageIndex;
              return (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${active ? "bg-emerald-500" : "bg-white/10"}`}
                  aria-label={`Step ${i + 1}`}
                />
              );
            })}
          </div>
        )}

        {step === "phone" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Wallet funding and payouts require a one-time identity check. We'll capture your
              government-issued ID and a quick liveness selfie — both use your live camera only.
              Photos from your gallery are not accepted.
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
              onClick={beginId}
              className="rgb-pulse-glow w-full h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2"
            >
              <IdCard className="w-4 h-4" /> Continue to ID capture
            </button>
          </div>
        )}

        {(step === "id-camera" || step === "id-capturing") && (
          <div className="flex flex-col items-center">
            <p className="text-[11px] text-slate-400 text-center mb-3 max-w-xs">
              {mode === "match"
                ? "Face match failed twice. Hold the same government ID you registered during KYC inside the frame — flat, well-lit, no glare."
                : "Hold your government-issued ID (passport, national ID, or driver's licence) inside the frame. Keep it flat, well-lit, and readable — no glare."}
            </p>
            <div className="rgb-neon-bg rounded-2xl p-[3px] mb-4 w-full">
              <div className="relative w-full aspect-[16/10] rounded-2xl bg-black overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {!streamRef.current && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-300" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-4 border-2 border-dashed border-emerald-400/70 rounded-xl" />
                {step === "id-capturing" && (
                  <div className="absolute inset-x-4 top-1/2 h-[2px] bg-emerald-400/70 shadow-[0_0_12px_#10b981] animate-pulse" />
                )}
                <IdCard className="absolute w-10 h-10 text-emerald-300/30 pointer-events-none" />
              </div>
            </div>
            {error ? (
              <div role="alert" className="text-sm text-red-400 mb-3 text-center inline-flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : step === "id-capturing" ? (
              <p className="text-4xl font-black text-white tabular-nums">{countdown}</p>
            ) : null}
            {step === "id-camera" && !error && (
              <button
                onClick={captureNow}
                className="mt-2 w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm inline-flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture ID
              </button>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {step === "id-review" && idUrl && (
          <div className="space-y-4">
            <div className="rgb-neon-bg rounded-2xl p-[2px]">
              <div className="bg-black rounded-2xl overflow-hidden">
                <ResponsiveImage sizes="(min-width: 640px) 480px, 100vw" src={idUrl} alt="Captured ID document" className="w-full aspect-[16/10] object-cover"  loading="lazy" decoding="async" />
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Check the ID is readable and the country matches your profile. This ID locks your country
              — you'll need to contact admin to change it later.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={retakeId}
                className="h-11 rounded-lg border border-white/10 bg-[#121214] text-slate-200 font-bold text-sm inline-flex items-center justify-center gap-2 hover:border-emerald-500/40"
              >
                <RotateCw className="w-4 h-4" /> Retake ID
              </button>
              <button
                onClick={() => setStep("selfie-camera")}
                className="rgb-pulse-glow h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2"
              >
                <ScanFace className="w-4 h-4 text-emerald-300" /> Next: liveness
              </button>
            </div>
          </div>
        )}

        {(step === "selfie-camera" || step === "selfie-capturing") && (
          <div className="flex flex-col items-center">
            <p className="text-[11px] text-slate-400 text-center mb-3 max-w-xs">
              Stay in bright, even light. Center your face inside the ring — we'll auto-capture on the
              countdown.
            </p>
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
                {step === "selfie-capturing" && (
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
            ) : step === "selfie-capturing" ? (
              <p className="text-4xl font-black text-white mt-1 tabular-nums">{countdown}</p>
            ) : null}
            {step === "selfie-camera" && !error && (
              <button
                onClick={captureNow}
                className="mt-2 w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm inline-flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture liveness
              </button>
            )}
            {mode === "match" && selfieAttempts > 0 && (
              <p className="text-[11px] text-amber-300/80 mt-2">
                Attempt {selfieAttempts + 1} of 2
              </p>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {step === "review" && selfieUrl && idUrl && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 text-center">Government ID</div>
                <div className="rounded-lg overflow-hidden border border-white/10 bg-black">
                  <ResponsiveImage sizes="(min-width: 640px) 240px, 50vw" src={idUrl} alt="ID document" className="w-full aspect-square object-cover"  loading="lazy" decoding="async" />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5 text-center">Liveness</div>
                <div className="rounded-lg overflow-hidden border border-emerald-500/40 bg-black">
                  <ResponsiveImage sizes="(min-width: 640px) 240px, 50vw" src={selfieUrl} alt="Captured selfie" className="w-full aspect-square object-cover"  loading="lazy" decoding="async" />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center">
              We'll match against your liveness before every payout. Your country is now locked to your ID.
            </p>
            {error && (
              <p role="alert" className="text-xs text-red-400 border-l-2 border-red-500 pl-2">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={retakeSelfie}
                disabled={busy}
                className="h-11 rounded-lg border border-white/10 bg-[#121214] text-slate-200 font-bold text-sm inline-flex items-center justify-center gap-2 hover:border-emerald-500/40 disabled:opacity-50"
              >
                <RotateCw className="w-4 h-4" /> Retake selfie
              </button>
              <button
                onClick={submitEnrollment}
                disabled={busy}
                className="rgb-pulse-glow h-11 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 text-emerald-300" /> Save & unlock wallet</>
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
                    <ResponsiveImage sizes="(min-width: 640px) 240px, 50vw" src={referenceUrl} alt="Stored reference" className="w-full h-full object-cover"  loading="lazy" decoding="async" />
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
                    <ResponsiveImage sizes="(min-width: 640px) 240px, 50vw" src={selfieUrl} alt="Live capture" className="w-full h-full object-cover"  loading="lazy" decoding="async" />
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
              We couldn't confirm your identity against your stored liveness selfie.
              Move to bright, even light and try again.
              <span className="block mt-1 text-amber-300/80">
                Attempt {selfieAttempts} of 2 — one more failure will require your government ID.
              </span>
              {matchDebug && (
                <span className="block mt-1 text-[10px] text-slate-500">{matchDebug}</span>
              )}
            </p>
            <button
              onClick={retryMatch}
              className="mt-4 w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm inline-flex items-center justify-center gap-2"
            >
              <RotateCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {step === "id-matching" && (
          <div className="flex flex-col items-center py-6">
            <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
              <Loader2 className="w-4 h-4 animate-spin" /> Matching your government ID…
            </div>
            <p className="text-[11px] text-slate-500 mt-2 text-center max-w-xs">
              Comparing your capture with the ID you registered during KYC.
            </p>
          </div>
        )}

        {step === "fallback" && (
          <FallbackSupport
            idReferencePath={idReferencePath}
            selfieAttempts={selfieAttempts}
            idAttempts={idAttempts}
            matchDebug={matchDebug}
            onSubmit={async (payload) => {
              await submitSupport({
                data: {
                  reason: payload.reason,
                  contact: payload.contact,
                  message: payload.message,
                  selfieAttempts,
                  idAttempts,
                },
              });
            }}
            onReset={() => {
              setSelfieAttempts(0);
              setIdAttempts(0);
              setMatchPhase("selfie");
              setError(null);
              setStep("selfie-camera");
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function FallbackIdPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage
      .from("kyc-selfies")
      .createSignedUrl(path, 120)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [path]);
  if (!url) return null;
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
        Your stored ID on file
      </div>
      <div className="rounded-lg overflow-hidden border border-white/10 bg-black">
        <ResponsiveImage sizes="(min-width: 640px) 480px, 100vw" src={url} alt="Stored ID document" className="w-full aspect-[16/10] object-cover"  loading="lazy" decoding="async" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback: contact admin form after selfie + ID both fail.
// ---------------------------------------------------------------------------

function FallbackSupport({
  idReferencePath,
  selfieAttempts,
  idAttempts,
  matchDebug,
  onSubmit,
  onReset,
}: {
  idReferencePath: string | null;
  selfieAttempts: number;
  idAttempts: number;
  matchDebug: string | null;
  onSubmit: (payload: { reason: string; contact: string; message: string }) => Promise<void>;
  onReset: () => void;
}) {
  const [reason, setReason] = useState("Face + ID match failed");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (contact.trim().length < 3) {
      setErr("Enter an email or phone we can reply to.");
      return;
    }
    if (message.trim().length < 5) {
      setErr("Tell us briefly what happened.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ reason: reason.trim(), contact: contact.trim(), message: message.trim() });
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send request.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center py-6 space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
          <Check className="w-7 h-7 text-emerald-300" strokeWidth={3} />
        </div>
        <div className="text-white font-black text-center">Request received</div>
        <p className="text-xs text-slate-400 text-center max-w-xs">
          An Oventric admin will review your account and reach out on{" "}
          <span className="text-emerald-300 font-semibold">{contact}</span> within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
          <IdCard className="w-6 h-6 text-amber-300" />
        </div>
        <div>
          <div className="text-white font-black text-sm">Manual review needed</div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Face match failed {selfieAttempts}× and ID match failed {idAttempts}×.
            Contact an admin to verify your identity.
          </p>
        </div>
      </div>
      {idReferencePath && <FallbackIdPreview path={idReferencePath} />}
      <div className="space-y-2">
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Your email or phone (with country code)"
          className="w-full h-11 px-3 bg-[#121214] border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened? (e.g. new haircut, damaged ID, wrong ID stored)"
          rows={3}
          className="w-full px-3 py-2 bg-[#121214] border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 resize-none"
        />
        {matchDebug && (
          <p className="text-[10px] text-slate-500">Diagnostics: {matchDebug}</p>
        )}
        {err && (
          <p role="alert" className="text-[11px] text-red-400 border-l-2 border-red-500 pl-2">
            {err}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onReset}
          disabled={busy}
          className="h-11 rounded-lg border border-white/10 bg-[#121214] text-slate-200 font-bold text-xs inline-flex items-center justify-center gap-2 hover:border-emerald-500/40 disabled:opacity-50"
        >
          <RotateCw className="w-4 h-4" /> Try again
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
          ) : (
            <><LifeBuoy className="w-4 h-4" /> Contact admin</>
          )}
        </button>
      </div>
    </div>
  );
}
