import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, X, ZoomIn } from "lucide-react";

interface Props {
  /** Object URL / data URL of the picked image. */
  src: string;
  /** Output edge length in px (square). */
  size?: number;
  /** Aspect ratio of the crop frame: 1 = square avatar, >1 = wide cover. */
  aspect?: number;
  title?: string;
  onCancel: () => void;
  onCropped: (blob: Blob, previewUrl: string) => void;
}

/**
 * Lightweight client-side cropper — drag to reposition, slider to zoom.
 * Renders the visible frame to a canvas so we upload an already-cropped,
 * compressed JPEG instead of the raw camera file.
 */
export function AvatarCropper({
  src,
  size = 512,
  aspect = 1,
  title = "Crop image",
  onCancel,
  onCropped,
}: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [src, reset]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const confirm = useCallback(async () => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !natural) return;
    setBusy(true);
    try {
      const rect = frame.getBoundingClientRect();
      const outW = size;
      const outH = Math.round(size / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outW, outH);

      // The <img loading="lazy" decoding="async"> is rendered with object-fit: cover inside the frame, then
      // scaled by `zoom` and translated by `offset`. Mirror that maths here.
      const baseScale = Math.max(rect.width / natural.w, rect.height / natural.h);
      const scale = baseScale * zoom;
      const drawW = natural.w * scale;
      const drawH = natural.h * scale;
      const left = (rect.width - drawW) / 2 + offset.x;
      const top = (rect.height - drawH) / 2 + offset.y;
      const ratio = outW / rect.width;
      ctx.drawImage(img, left * ratio, top * ratio, drawW * ratio, drawH * ratio);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
      if (!blob) throw new Error("Could not render crop");
      onCropped(blob, URL.createObjectURL(blob));
    } finally {
      setBusy(false);
    }
  }, [aspect, natural, offset, onCropped, size, zoom]);

  return (
    <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-slate-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
          {title}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel crop"
          className="w-7 h-7 rounded-[10px] flex items-center justify-center text-slate-400 hover:text-white md:hover:text-slate-900 hover:bg-white/10 md:hover:bg-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ aspectRatio: String(aspect) }}
        className={`relative w-full overflow-hidden bg-black touch-none cursor-grab active:cursor-grabbing ${
          aspect === 1 ? "rounded-full max-w-[220px] mx-auto" : "rounded-xl"
        }`}
      >
        <img loading="lazy" decoding="async"
          ref={imgRef}
          src={src}
          alt="Crop preview"
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setNatural({ w: el.naturalWidth, h: el.naturalHeight });
          }}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          className="absolute inset-0 w-full h-full object-cover select-none will-change-transform"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
        />
        <button
          type="button"
          onClick={reset}
          aria-label="Reset crop"
          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-slate-400 hover:text-white md:hover:text-slate-900 hover:bg-white/10 md:hover:bg-slate-200"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-[10px] text-xs font-semibold text-slate-300 md:text-slate-600 hover:bg-white/10 md:hover:bg-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy || !natural}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-xs font-black"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Use image
        </button>
      </div>
    </div>
  );
}
