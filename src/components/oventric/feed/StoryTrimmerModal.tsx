import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Scissors, X } from "lucide-react";
import { MAX_STORY_VIDEO_SECONDS } from "@/lib/media/videoTrim";

/**
 * Lightweight 30s clip picker: scrub the start point, preview the window and
 * confirm. Shown whenever a chosen video is longer than the story limit.
 */
export function StoryTrimmerModal({
  file,
  duration,
  working,
  progress,
  onCancel,
  onConfirm,
}: {
  file: File;
  duration: number;
  working: boolean;
  progress: number;
  onCancel: () => void;
  onConfirm: (start: number) => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [start, setStart] = useState(0);
  const maxStart = Math.max(0, duration - MAX_STORY_VIDEO_SECONDS);
  const end = Math.min(duration, start + MAX_STORY_VIDEO_SECONDS);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || working) return;
    try {
      v.currentTime = start;
    } catch {
      /* noop */
    }
  }, [start, working]);

  if (typeof document === "undefined") return null;

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/80 backdrop-blur-xl sm:items-center">
      <div className="w-full max-w-[440px] rounded-t-3xl border border-white/10 bg-[#141416] p-4 pb-6 sm:rounded-3xl">
        <div className="mb-3 flex items-center gap-2">
          <Scissors className="h-4 w-4 text-[#E5484D]" />
          <p className="text-[14px] font-semibold text-white">Trim to 30 seconds</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/70 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            src={url}
            muted
            playsInline
            preload="auto"
            className="max-h-[46vh] w-full object-contain"
          />
        </div>

        <p className="mt-3 text-[12px] text-white/55">
          Clip window: {fmt(start)} – {fmt(end)} of {fmt(duration)}
        </p>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, maxStart)}
          step={0.1}
          value={start}
          disabled={working}
          onChange={(e) => setStart(Number(e.target.value))}
          className="mt-2 w-full accent-[#E5484D]"
          aria-label="Clip start time"
        />

        {working && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#E5484D] transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-white/50">Preparing your clip…</p>
          </div>
        )}

        <button
          type="button"
          disabled={working}
          onClick={() => onConfirm(start)}
          className="mt-4 w-full rounded-full bg-[#E5484D] py-3 text-[14px] font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
        >
          {working ? "Trimming…" : "OK, use this clip"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
