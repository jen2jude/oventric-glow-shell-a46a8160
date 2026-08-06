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
};

const PROMOS: Promo[] = [
  {
    id: "assets",
    title: "Download Millions of Digital Assets for Free",
    subtitle: "Grab free templates, kits & more",
    icon: Download,
    tint: "from-blue-500/25 to-blue-500/5",
    glow: "rgba(59,130,246,0.45)",
    section: "Marketplace",
  },
  {
    id: "shopping",
    title: "Save Big on all your Shopping",
    subtitle: "Up to 10% cashback on every order",
    icon: ShoppingBag,
    tint: "from-sky-400/25 to-sky-400/5",
    glow: "rgba(56,189,248,0.45)",
    section: "Marketplace",
  },
  {
    id: "skills",
    title: "Learn high value digital skills",
    subtitle: "Earn while you learn on Academy",
    icon: GraduationCap,
    tint: "from-indigo-500/25 to-indigo-500/5",
    glow: "rgba(99,102,241,0.45)",
    section: "Academy",
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
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
            className="group inline-flex h-9 w-9 items-center justify-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-6 bg-blue-400" : "w-1.5 bg-white/25 group-hover:bg-white/45"
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
      <div className="promo-banner-card relative overflow-hidden rounded-[10px] bg-slate-950/55 backdrop-blur-xl border border-white/10 px-4 py-4 min-h-[5.5rem] md:px-5 md:py-5 flex items-center gap-3 md:gap-4 active:scale-[0.985] transition-transform duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hub-card-glass hub-card-glow">
        <span
          aria-hidden
          className="promo-glow absolute -left-6 -top-8 h-28 w-28 rounded-full blur-2xl opacity-60"
          style={{ background: `radial-gradient(circle, ${p.glow}, transparent 70%)` }}
        />
        <span
          className={`relative shrink-0 h-14 w-14 md:h-16 md:w-16 rounded-[10px] bg-gradient-to-b ${p.tint} border border-white/15 flex items-center justify-center backdrop-blur-md`}
        >
          <p.icon className="w-7 h-7 text-blue-300" strokeWidth={2.5} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-sm md:text-base font-extrabold text-white leading-snug line-clamp-2">
            {p.title}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5 truncate">{p.subtitle}</span>
        </span>
        <span className="relative shrink-0 h-11 min-w-[3.25rem] px-4 justify-center rounded-full bg-blue-500/10 border border-blue-400/50 text-blue-300 text-xs font-bold inline-flex items-center backdrop-blur-sm">
          GO
        </span>
      </div>
    </button>
  );
}

