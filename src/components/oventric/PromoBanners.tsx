import { useEffect, useRef, useState } from "react";
import { Download, ShoppingBag, GraduationCap, type LucideIcon } from "lucide-react";
import { trackPromoEvent, usePromoImpression } from "@/lib/promo-analytics";

type Promo = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  glow: string;
  section: string;
  img?: string;
};

const PROMOS: Promo[] = [
  {
    id: "assets",
    title: "Download Millions of Digital Assets for Free",
    subtitle: "Grab free templates, kits & more",
    icon: Download,
    tint: "from-slate-800/50 to-slate-900/50",
    glow: "transparent",
    section: "Marketplace",
    img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "shopping",
    title: "Save Big on all your Shopping",
    subtitle: "Up to 10% cashback on every order",
    icon: ShoppingBag,
    tint: "from-slate-800/50 to-slate-900/50",
    glow: "transparent",
    section: "Marketplace",
    img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "skills",
    title: "Learn high value digital skills",
    subtitle: "Earn while you learn on Academy",
    icon: GraduationCap,
    tint: "from-slate-800/50 to-slate-900/50",
    glow: "transparent",
    section: "Academy",
    img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80",
  },
];

export function PromoBanners({ onSelect }: { onSelect: (section: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  const scrollTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Auto-advance (skipped when the user prefers reduced motion)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const el = trackRef.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % PROMOS.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  return (
    <section aria-label="Promotions">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={() => (pausedRef.current = true)}
        onPointerUp={() => (pausedRef.current = false)}
        onPointerCancel={() => (pausedRef.current = false)}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
        onFocusCapture={() => (pausedRef.current = true)}
        onBlurCapture={() => (pausedRef.current = false)}
        className="flex overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {PROMOS.map((p) => (
          <PromoSlide key={p.id} promo={p} onSelect={onSelect} />
        ))}
      </div>

      <div className="mt-1 flex items-center justify-center">
        {PROMOS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Show promotion ${i + 1}`}
            aria-current={i === active ? "true" : undefined}
            className="group inline-flex h-11 w-11 items-center justify-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-6 bg-white" : "w-1.5 bg-white/25 group-hover:bg-white/45"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function PromoSlide({ promo: p, onSelect }: { promo: Promo; onSelect: (section: string) => void }) {
  const ref = usePromoImpression<HTMLButtonElement>({
    id: `banner-${p.id}`,
    title: p.title,
    surface: "home_banner",
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        void trackPromoEvent("click", {
          id: `banner-${p.id}`,
          title: p.title,
          surface: "home_banner",
        });
        onSelect(p.section);
      }}
      className="snap-center shrink-0 w-full text-left focus-visible:outline-none"
    >
      <div className="promo-banner-card relative overflow-hidden rounded-[10px] bg-oklch(0.24 0 0) border border-white/10 px-4 py-4 min-h-[5.5rem] md:px-5 md:py-5 flex items-center gap-3 md:gap-4 active:scale-[0.985] transition-transform duration-300 shadow-lg shadow-black/40">
        {p.img && (
          <div className="absolute inset-0 opacity-40">
            <img loading="lazy" decoding="async" src={p.img} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-oklch(0.24 0 0) via-oklch(0.24 0 0 / 80%) to-transparent" />
          </div>
        )}
        <span
          className={`relative shrink-0 h-14 w-14 md:h-16 md:w-16 rounded-[10px] bg-oklch(0.3 0 0) border border-white/15 flex items-center justify-center`}
        >
          <p.icon className="w-7 h-7 text-white" strokeWidth={2.5} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-sm md:text-base font-extrabold text-white leading-snug line-clamp-2">
            {p.title}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5 truncate">{p.subtitle}</span>
        </span>
        <span className="relative shrink-0 h-11 min-w-[3.25rem] px-4 justify-center rounded-[10px] bg-white/5 border border-white/20 text-white text-xs font-bold inline-flex items-center">
          GO
        </span>
      </div>
    </button>
  );
}
