import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import home3d from "@/assets/home-3d.png.asset.json";
import marketplace3d from "@/assets/marketplace-3d.png.asset.json";
import academy3d from "@/assets/academy-3d.png.asset.json";
import bounties3d from "@/assets/bounties-3d.webp.asset.json";
import wallet3d from "@/assets/wallet-3d.webp.asset.json";
import oventricFull from "@/assets/oventric-full.asset.json";
import { markCarouselSeen as markCarouselSeenFn } from "@/lib/carousel.functions";

interface Slide {
  id: string;
  image: string;
  title: string;
  description: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    id: "feed",
    image: home3d.url,
    title: "Feed",
    description: "Connect with builders, share updates, and discover what your network is creating.",
    accent: "#00c2ff",
  },
  {
    id: "marketplace",
    image: marketplace3d.url,
    title: "Marketplace",
    description: "Buy and sell digital & physical products with escrow-protected payments.",
    accent: "#ff4d6d",
  },
  {
    id: "academy",
    image: academy3d.url,
    title: "Academy",
    description: "Learn new skills, publish courses, and earn credentials that matter.",
    accent: "#22ff88",
  },
  {
    id: "bounties",
    image: bounties3d.url,
    title: "Bounties",
    description: "Post open work, solve challenges, and get paid when the job ships.",
    accent: "#ffb020",
  },
  {
    id: "wallet",
    image: wallet3d.url,
    title: "Sovereign Wallet",
    description: "Hold NGN, GHS, or USD with cashback, affiliate earnings, and instant payouts.",
    accent: "#7aa2ff",
  },
];

export function FeatureCarousel({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const markSeenServer = useServerFn(markCarouselSeenFn);

  const handleComplete = useCallback(() => {
    // Fire-and-forget server sync for signed-in users; localStorage is the
    // source of truth on the device, but this keeps the flag in sync across
    // devices when the user has a session.
    try {
      void markSeenServer({ data: {} });
    } catch {
      // ignore
    }
    onComplete();
  }, [markSeenServer, onComplete]);

  const goTo = useCallback((next: number, dir: number) => {
    setDirection(dir);
    setIndex((prev) => {
      if (next < 0) return SLIDES.length - 1;
      if (next >= SLIDES.length) return 0;
      return next;
    });
  }, []);

  const next = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") handleComplete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, handleComplete]);

  // Touch swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0]!.clientX);
    setTouchDelta(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0]!.clientX - touchStart);
  };

  const onTouchEnd = () => {
    if (touchStart === null) return;
    const threshold = 60;
    if (touchDelta > threshold) prev();
    else if (touchDelta < -threshold) next();
    setTouchStart(null);
    setTouchDelta(0);
  };

  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center bg-[#121214] text-white"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-modal="true"
      role="dialog"
      aria-label="Welcome to Oventric"
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-5 pb-4 z-10">
        <img src={oventricFull.url} alt="Oventric" className="h-8 w-auto select-none" draggable={false} />
        <button
          onClick={handleComplete}
          className="flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          aria-label="Skip introduction"
        >
          Skip <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Slide content */}
      <div className="relative w-full max-w-md px-6 flex-1 flex flex-col items-center justify-center">
        <div
          key={slide.id}
          className="feature-carousel-slide flex flex-col items-center text-center"
          style={{
            animation: "feature-carousel-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <div
            className="relative w-56 h-56 sm:w-64 sm:h-64 mb-8 rounded-3xl overflow-hidden bg-[#1E1E24] border border-white/10 flex items-center justify-center"
            style={{ boxShadow: `0 0 40px -10px ${slide.accent}30` }}
          >
            <img
              src={slide.image}
              alt=""
              className="w-full h-full object-contain p-4 select-none"
              draggable={false}
            />
          </div>

          <div
            className="w-12 h-1 rounded-full mb-5"
            style={{ backgroundColor: slide.accent }}
          />

          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
            {slide.title}
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xs">
            {slide.description}
          </p>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-md px-6 pb-8 pt-4 z-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i, i > index ? 1 : -1)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-8" : "w-2 bg-white/25 hover:bg-white/40"
              }`}
              style={{ backgroundColor: i === index ? slide.accent : undefined }}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            className="h-12 w-12 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center text-white hover:bg-[#2a2a2a] transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>

          <button
            onClick={isLast ? handleComplete : next}
            className="flex-1 h-12 rounded-full bg-white text-black font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            {isLast ? "Get started" : "Next"}
          </button>

          <button
            onClick={next}
            className="h-12 w-12 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center text-white hover:bg-[#2a2a2a] transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
