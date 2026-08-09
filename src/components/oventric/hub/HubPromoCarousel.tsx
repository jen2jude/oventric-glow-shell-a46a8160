import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import digitalImg from "@/assets/promo-digital.png";
import shoppingImg from "@/assets/promo-shopping.png";
import assetsImg from "@/assets/promo-assets.png";
import referImg from "@/assets/promo-refer.png";

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  img: string;
  /** Card background gradient. */
  bg: string;
  /** Title / body text colour class. */
  text: string;
  sub: string;
  /** CTA pill classes. */
  pill: string;
  section: string;
};

const SLIDES: Slide[] = [
  {
    id: "digital",
    title: "Shop & download millions of free digital assets",
    subtitle: "Get premium themes, plugins, AI tools & more.",
    cta: "Explore Assets",
    img: digitalImg,
    bg: "linear-gradient(110deg, #4C1D95 0%, #6D28D9 55%, #2E1065 100%)",
    text: "text-white",
    sub: "text-white/70",
    pill: "bg-black/70 text-white",
    section: "Marketplace",
  },
  {
    id: "shopping",
    title: "Save big on all your shopping",
    subtitle: "Buy from real sellers",
    cta: "Shop Now",
    img: shoppingImg,
    bg: "linear-gradient(110deg, #5B0F14 0%, #3A0A12 55%, #1B0A14 100%)",
    text: "text-white",
    sub: "text-white/70",
    pill: "bg-black/70 text-white",
    section: "Marketplace",
  },
  {
    id: "assets",
    title: "Earn 2% cashback on every purchase",
    subtitle: "Money back into your cashback wallet.",
    cta: "Shop Now",
    img: assetsImg,
    bg: "linear-gradient(110deg, #F7B500 0%, #F59E0B 60%, #E8890B 100%)",
    text: "text-black",
    sub: "text-black/70",
    pill: "bg-black text-white",
    section: "Marketplace",
  },
  {
    id: "refer",
    title: "Refer a friend & earn",
    subtitle: "Get up to $0.010 for every builder you invite.",
    cta: "Invite Friends",
    img: referImg,
    bg: "linear-gradient(110deg, #2BD07A 0%, #21C36F 55%, #14A45C 100%)",
    text: "text-black",
    sub: "text-black/70",
    pill: "bg-black text-white",
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
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) % SLIDES.length);
  };

  return (
    <section aria-label="Offers">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => (paused.current = false)}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s) => (
          <div key={s.id} className="w-full shrink-0 snap-center px-0.5">
            <button
              type="button"
              onClick={() => onSelect(s.section)}
              className="relative w-full overflow-hidden rounded-2xl text-left active:scale-[0.99] transition-transform"
              style={{ backgroundImage: s.bg }}
            >
              <div className="relative z-10 max-w-[62%] p-4">
                <div className={`text-[17px] font-extrabold leading-tight ${s.text}`}>
                  {s.title}
                </div>
                <div className={`mt-1 text-[12px] leading-snug ${s.sub}`}>{s.subtitle}</div>
                <span
                  className={`mt-3 inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[12px] font-bold ${s.pill}`}
                >
                  {s.cta} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <img
                src={s.img}
                alt=""
                aria-hidden
                loading="lazy"
                width={768}
                height={768}
                className="pointer-events-none absolute right-1 bottom-0 h-[112%] w-auto max-w-[46%] object-contain"
              />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-1.5">
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
                ? "h-1.5 w-5 rounded-full bg-[#E5484D] transition-all"
                : "h-1.5 w-1.5 rounded-full bg-white/25 transition-all"
            }
          />
        ))}
      </div>
    </section>
  );
}
