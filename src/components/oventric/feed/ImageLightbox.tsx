import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, MousePointerClick, Pause } from "lucide-react";
import { ResponsiveImage } from "@/components/ui/responsive-image";

interface GalleryProps {
  images: string[];
  startIndex?: number;
  alt?: string;
  onClose: () => void;
}

// Backward-compatible props: callers may still pass `src` (single image).
type LegacyProps = { src: string; alt?: string; onClose: () => void };

export function ImageLightbox(props: GalleryProps | LegacyProps) {
  const images = "images" in props ? props.images : [props.src];
  const startIndex = "images" in props ? (props.startIndex ?? 0) : 0;
  const { alt, onClose } = props;

  const [index, setIndex] = useState(startIndex);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const teasedRef = useRef(false);

  const total = images.length;
  const clamp = (i: number) => Math.max(0, Math.min(total - 1, i));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => clamp(i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => clamp(i - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, total]);

  // Snap the track to the active image
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const target = el.children[index] as HTMLElement | undefined;
    if (target) target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  // Idle peek: after 10s viewing an image, slowly reveal the next image halfway, then return.
  // Cancels on user interaction (scroll/touch/wheel/key) or when the index changes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (total <= 1) return;
    if (index >= total - 1) return; // no next image to tease

    let returnTimer: number | undefined;
    const peekTimer = window.setTimeout(() => {
      const width = el.clientWidth;
      const base = index * width;
      el.scrollTo({ left: base + Math.round(width * 0.5), behavior: "smooth" });
      returnTimer = window.setTimeout(() => {
        el.scrollTo({ left: base, behavior: "smooth" });
      }, 1400);
    }, 10000);

    const cancel = () => {
      window.clearTimeout(peekTimer);
      if (returnTimer) window.clearTimeout(returnTimer);
    };
    el.addEventListener("touchstart", cancel, { passive: true });
    el.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("keydown", cancel);

    return () => {
      cancel();
      el.removeEventListener("touchstart", cancel);
      el.removeEventListener("wheel", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [index, total]);

  // Update index on scroll (swipe) — debounced via rAF for smoothness
  const rafRef = useRef<number | null>(null);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const w = el.clientWidth;
      const i = Math.round(el.scrollLeft / w);
      if (i !== index) setIndex(clamp(i));
    });
  };

  // Translate vertical wheel to horizontal scroll for smooth desktop navigation
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY, behavior: "smooth" });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20"
      >
        <X className="w-5 h-5" />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIndex((i) => clamp(i - 1)); }}
            aria-label="Previous image"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 disabled:opacity-30"
            disabled={index === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIndex((i) => clamp(i + 1)); }}
            aria-label="Next image"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 disabled:opacity-30"
            disabled={index === total - 1}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/70 border border-white/20 text-white text-xs">
            {index + 1} / {total}
          </div>
        </>
      )}

      <div
        ref={trackRef}
        onScroll={onScroll}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth overscroll-x-contain"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}
      >
        {images.map((src, i) => (
          <div key={src + i} className="w-full h-full shrink-0 snap-center flex items-center justify-center p-4">
            <ResponsiveImage
              src={src}
              alt={alt ?? `Image ${i + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
