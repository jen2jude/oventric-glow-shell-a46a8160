import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, RotateCcw, Loader2, HeartHandshake, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reactivateMyAccount } from "@/lib/profiles.functions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  daysRemaining: number;
  onReactivated: () => void;
  onSignOut: () => void;
}

type Phase = "prompt" | "camera" | "confirm" | "submitting";

export function ReactivationModal({ open, daysRemaining, onReactivated, onSignOut }: Props) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submit = useServerFn(reactivateMyAccount);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("kyc-active");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("kyc-active");
    };
  }, [open]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (phase !== "camera") {
      stopCam();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError("Camera access denied.");
        setPhase("prompt");
      }
    })();
    return () => {
      cancelled = true;
      stopCam();
    };
  }, [phase, stopCam]);

  useEffect(() => () => stopCam(), [stopCam]);

  const capture = useCallback(() => {
    const v = videoRef.current,
      c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (b) => {
        if (!b) return;
        setSelfie(b);
        setSelfieUrl(URL.createObjectURL(b));
        stopCam();
        setPhase("confirm");
      },
      "image/jpeg",
      0.85,
    );
  }, [stopCam]);

  const finish = useCallback(async () => {
    if (!selfie) return;
    setError(null);
    setPhase("submitting");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/reactivation_${Date.now()}.jpg`;
      const up = await supabase.storage
        .from("kyc-selfies")
        .upload(path, selfie, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      await submit({ data: { livenessPath: path } });
      toast.success("Welcome back! Your account is active again.");
      onReactivated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reactivate.");
      setPhase("confirm");
    }
  }, [selfie, submit, onReactivated]);

  if (!open) return null;

  return (
    <div className="modal-light fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#0f0d10] border border-amber-400/30 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <HeartHandshake className="w-6 h-6 text-amber-300" />
          <div>
            <h2 className="text-sm font-bold text-amber-100">
              Your account is scheduled for deletion
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to reactivate.`
                : "Final day to reactivate."}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {phase === "prompt" && (
            <>
              <p className="text-slate-300">
                Want to keep your Oventric account? Confirm it's you with a quick face check and
                we'll cancel the deletion immediately.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    setError(null);
                    setPhase("camera");
                  }}
                  className="w-full h-11 rounded-full bg-amber-400/20 border border-amber-400/60 text-amber-100 text-sm font-bold hover:bg-amber-400/30"
                >
                  Yes, reactivate my account
                </button>
                <button
                  onClick={onSignOut}
                  className="w-full h-11 rounded-full bg-[#141418] border border-white/10 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2 hover:border-red-400/40"
                >
                  <LogOut className="w-4 h-4" /> No thanks, sign me out
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}

          {phase === "camera" && (
            <>
              <p className="text-xs text-slate-300">Take a quick selfie to confirm it's you.</p>
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              </div>
              <button
                onClick={capture}
                className="w-full h-11 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture selfie
              </button>
            </>
          )}

          {phase === "confirm" && selfieUrl && (
            <>
              <img loading="lazy" decoding="async"
                src={selfieUrl}
                alt="Liveness selfie"
                className="w-full rounded-2xl border border-white/10"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelfie(null);
                    setSelfieUrl(null);
                    setPhase("camera");
                  }}
                  className="flex-1 h-11 rounded-full bg-[#141418] border border-white/10 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Retake
                </button>
                <button
                  onClick={finish}
                  className="flex-1 h-11 rounded-full bg-amber-400/25 border border-amber-400/60 text-amber-100 text-sm font-bold"
                >
                  Reactivate
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}

          {phase === "submitting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-amber-300 animate-spin" />
              <p className="text-xs text-slate-300">Reactivating…</p>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
