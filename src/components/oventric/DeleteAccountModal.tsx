import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Camera, RotateCcw, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/profiles.functions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

type Phase = "form" | "camera" | "confirm" | "submitting";

export function DeleteAccountModal({ open, onClose, onDeleted }: Props) {
  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submitDelete = useServerFn(deleteMyAccount);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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
        setError("Camera access denied. Please allow camera permission and try again.");
        setPhase("form");
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
    const w = v.videoWidth,
      h = v.videoHeight;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
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

  const submit = useCallback(async () => {
    if (!selfie) return;
    setError(null);
    setPhase("submitting");
    try {
      if (confirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
        throw new Error("Email confirmation does not match.");
      }
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/deletion_${Date.now()}.jpg`;
      const up = await supabase.storage
        .from("kyc-selfies")
        .upload(path, selfie, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      await submitDelete({ data: { confirmEmail, reason: reason.trim(), livenessPath: path } });
      toast.success("Deletion scheduled. You have 30 days to reactivate.");
      await supabase.auth.signOut();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule deletion.");
      setPhase("confirm");
    }
  }, [selfie, confirmEmail, email, reason, submitDelete, onDeleted]);

  if (!open) return null;

  return (
    <div className="modal-light fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#0f0d10] border border-red-500/30 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-red-200">Delete my account</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {phase === "form" && (
            <>
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-200/90">
                Your account will be scheduled for deletion. You have <b>30 days</b> to sign in and
                reactivate. After that, all data is permanently removed and cannot be recovered.
              </div>
              <label className="block text-xs font-semibold text-slate-300">
                Why are you leaving?{" "}
                <span className="text-slate-500">(required, helps us improve)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full rounded-xl bg-[#141418] border border-white/10 p-3 text-sm text-slate-100 outline-none focus:border-red-400/50"
                  placeholder="Tell us briefly what's not working for you…"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Type your email to confirm: <span className="text-slate-400">{email}</span>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-[#141418] border border-white/10 p-3 text-sm text-slate-100 outline-none focus:border-red-400/50"
                  placeholder="you@example.com"
                />
              </label>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                disabled={
                  reason.trim().length < 4 ||
                  confirmEmail.trim().toLowerCase() !== email.toLowerCase()
                }
                onClick={() => {
                  setError(null);
                  setPhase("camera");
                }}
                className="w-full h-11 rounded-full bg-red-500/20 border border-red-500/50 text-red-100 text-sm font-bold hover:bg-red-500/30 disabled:opacity-40"
              >
                Continue to liveness check
              </button>
            </>
          )}

          {phase === "camera" && (
            <>
              <p className="text-xs text-slate-300">
                Position your face inside the frame and take a selfie to confirm it's you.
              </p>
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
              <p className="text-xs text-slate-300">Use this photo?</p>
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
                  onClick={submit}
                  className="flex-1 h-11 rounded-full bg-red-500/25 border border-red-500/60 text-red-100 text-sm font-bold"
                >
                  Delete my account
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}

          {phase === "submitting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-red-300 animate-spin" />
              <p className="text-xs text-slate-300">Scheduling deletion…</p>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
