import { useRef, useState } from "react";
import { trackPromoEvent, usePromoImpression } from "@/lib/promo-analytics";

type Spotlight = {
  id: string;
  label: string;
  title: string;
  img: string;
  section: string;
};

const SPOTLIGHTS: Spotlight[] = [
  {
    id: "creator",
    label: "Creator Spotlight:",
    title: "Grow your digital business with Oventric",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    section: "Feed",
  },
  {
    id: "earn",
    label: "Earn Spotlight:",
    title: "Make money on Oventric every single day",
    img: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=80",
    section: "Wallet",
  },
  {
    id: "digital",
    label: "Seller Spotlight:",
    title: "Sell digital assets — themes, plugins & templates",
    img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80",
    section: "Marketplace",
  },
  {
    id: "skills",
    label: "Talent Spotlight:",
    title: "Showcase your skills and services to real buyers",
    img: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80",
    section: "Feed",
  },
  {
    id: "bounties",
    label: "Bounty Spotlight:",
    title: "Solve bounties and get paid for your work",
    img: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=400&q=80",
    section: "Bounties",
  },
  {
    id: "academy",
    label: "Academy Spotlight:",
    title: "Teach what you know and earn from your courses",
    img: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80",
    section: "Academy",
  },
  {
    id: "circles",
    label: "Community Spotlight:",
    title: "Join circles and build with people like you",
    img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80",
    section: "Circles",
  },
  {
    id: "cashback",
    label: "Shopper Spotlight:",
    title: "Shop and earn cashback on every order",
    img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80",
    section: "Marketplace",
  },
];

export function SpotlightRail({ onSelect }: { onSelect: (section: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  return (
    <section aria-label="Spotlights">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory scroll-smooth -mx-3 px-3 md:mx-0 md:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {SPOTLIGHTS.map((s) => (
          <SpotlightCard key={s.id} item={s} onSelect={onSelect} />
        ))}
      </div>

      <div className="mt-1 flex items-center justify-center">
        {SPOTLIGHTS.map((s, i) => (
          <span
            key={s.id}
            aria-hidden
            className={`mx-0.5 block h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-5 bg-[#E5484D]" : "w-1.5 bg-white/20"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

function SpotlightCard({
  item,
  onSelect,
}: {
  item: Spotlight;
  onSelect: (section: string) => void;
}) {
  const ref = usePromoImpression<HTMLButtonElement>({
    id: `spotlight-${item.id}`,
    title: item.title,
    surface: "home_spotlight",
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        void trackPromoEvent("click", {
          id: `spotlight-${item.id}`,
          title: item.title,
          surface: "home_spotlight",
        });
        onSelect(item.section);
      }}
      className="snap-center shrink-0 w-full text-left focus-visible:outline-none active:scale-[0.985] transition-transform duration-300"
    >
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#141418] pr-4 min-h-[6rem]">
        <span className="relative shrink-0 h-24 w-24 overflow-hidden">
          <img src={item.img} alt="" loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-transparent to-[#141418]" />
        </span>
        <span className="min-w-0 flex-1 py-3">
          <span className="block text-sm font-semibold leading-snug text-slate-200 line-clamp-3">
            <span className="font-extrabold text-white">{item.label}</span> {item.title}
          </span>
        </span>
      </div>
    </button>
  );
}
