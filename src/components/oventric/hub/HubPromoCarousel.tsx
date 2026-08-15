import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

type Slide = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  img: string;
  bg: string;
  glow: string;
  sideText?: string[];
  section: string;
};

const SLIDES: Slide[] = [
  {
    id: "main",
    badge: "MORE THAN A MARKETPLACE",
    title: "Discover Amazing Things",
    subtitle: "",
    description: "Products, digital assets, courses, jobs and a community that grows together.",
    cta: "Explore Now",
    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800",
    bg: "bg-gradient-to-br from-[#0A0A0B] to-[#1A1A1E]",
    glow: "shadow-[inset_0_0_100px_rgba(139,92,246,0.15)]",
    sideText: ["Better Choices", "Bigger Opportunities"],
    section: "Marketplace",
  },
  {
    id: "digital",
    badge: "PREMIUM ASSETS",
    title: "Shop & Download Digital Assets",
    subtitle: "",
    description: "Get premium themes, plugins, AI tools & more for your next big project.",
    cta: "Explore Assets",
    img: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&q=80&w=800",
    bg: "bg-gradient-to-br from-[#0A0A0B] to-[#1E1B4B]",
    glow: "shadow-[inset_0_0_100px_rgba(59,130,246,0.15)]",
    section: "Marketplace",
  },
  {
    id: "shopping",
    badge: "SAVE BIG",
    title: "Save Big On All Your Shopping",
    subtitle: "",
    description: "Buy from real sellers with verified reviews and secure escrow payments.",
    cta: "Shop Now",
    img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=800",
    bg: "bg-gradient-to-br from-[#0A0A0B] to-[#450A0A]",
    glow: "shadow-[inset_0_0_100px_rgba(229,72,77,0.15)]",
    section: "Marketplace",
  },
  {
    id: "refer",
    badge: "EARN REWARDS",
    title: "Refer A Friend & Earn Cashback",
    subtitle: "",
    description: "Invite your friends to Oventric and earn rewards on every successful purchase they make.",
    cta: "Invite Friends",
    img: "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&q=80&w=800",
    bg: "bg-gradient-to-br from-[#0A0A0B] to-[#064E3B]",
    glow: "shadow-[inset_0_0_100px_rgba(16,185,129,0.15)]",
    section: "Affiliate",
  },
];

export function HubPromoCarousel({ onSelect }: { onSelect: (section: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el || paused.current) return;
      const next = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % SLIDES.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) % SLIDES.length);
  };

  return (
    <section aria-label="Offers" className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => (paused.current = false)}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s) => (
          <div key={s.id} className="w-full shrink-0 snap-center">
            <button
              type="button"
              onClick={() => onSelect(s.section)}
              className={`relative w-full overflow-hidden rounded-[10px] text-left active:scale-[0.99] transition-transform aspect-[16/8.5] border border-white/[0.06] ${s.bg} ${s.glow}`}
            >
              {/* Left Content */}
              <div className="relative z-10 flex h-full flex-col justify-center max-w-[55%] p-7 md:p-10">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">
                  {s.badge}
                </div>
                <h2 className="text-[28px] md:text-[34px] font-black leading-[1.05] tracking-tight text-white mb-4">
                  {s.title}
                </h2>
                <p className="text-[13px] md:text-[14px] font-medium text-white/50 leading-relaxed mb-8 max-w-[90%]">
                  {s.description}
                </p>
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[12px] font-black text-black transition-all hover:bg-white/90">
                    {s.cta} <ChevronRight className="h-4 w-4" strokeWidth={3} />
                  </span>
                </div>
              </div>

              {/* Product Image and Effects */}
              <div className="absolute right-0 top-0 h-full w-[50%] flex items-center justify-center p-6">
                <div className="relative h-full w-full flex items-center justify-center">
                  {/* Purple Circle Glow */}
                  <div className="absolute h-[85%] aspect-square rounded-full border-2 border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.4)] animate-pulse" />
                  
                  {/* Product Image */}
                  <img 
                    src={s.img} 
                    alt="" 
                    className="relative z-20 h-[80%] w-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
                  />

                  {/* Script Text on Right (only for main slide) */}
                  {s.sideText && (
                    <div className="absolute right-0 bottom-10 z-30 flex flex-col items-end pointer-events-none pr-2">
                      {s.sideText.map((text, i) => (
                        <span key={i} className="text-[16px] md:text-[20px] font-serif italic text-white/80 leading-tight">
                          {text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to offer ${i + 1}`}
            onClick={() =>
              trackRef.current?.scrollTo({
                left: i * trackRef.current.clientWidth,
                behavior: "smooth",
              })
            }
            className={
              i === active
                ? "h-2 w-2 rounded-full bg-white transition-all scale-110"
                : "h-2 w-2 rounded-full bg-white/20 transition-all"
            }
          />
        ))}
      </div>
    </section>
  );
}
