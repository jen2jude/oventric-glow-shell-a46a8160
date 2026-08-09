import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronRight } from "lucide-react";
import { trackPromoEvent } from "@/lib/promo-analytics";
import promoCashbackArt from "@/assets/promo-cashback.png";
import promoReferArt from "@/assets/promo-refer.png";
import promoAdvertiseArt from "@/assets/promo-advertise.png";

type Promo = {
  id: string;
  title: string;
  body: string;
  cta: string;
  art: string;
  to?: string;
  search?: Record<string, unknown>;
  section?: string;
};

const PROMOS: Promo[] = [
  {
    id: "cashback",
    title: "Earn 2% cashback",
    body: "Money back into your cashback wallet on every order.",
    cta: "Shop now",
    art: promoCashbackArt,
    section: "Marketplace",
  },
  {
    id: "refer",
    title: "Refer & earn",
    body: "Invite builders and earn from their activity.",
    cta: "Invite friends",
    art: promoReferArt,
    to: "/affiliate",
    search: { reserve: "1" },
  },
  {
    id: "advertise",
    title: "Advertise here",
    body: "Put your product in front of Africa's builders.",
    cta: "Start a campaign",
    art: promoAdvertiseArt,
    to: "/advertise",
    search: { start: "image" },
  },
];

const FIRST_DELAY = 25_000;
const INTERVAL = 180_000;

/**
 * Rotating promotional splash. Replaces the old inline promo rail: it appears
 * on an interval as a light overlay with a close button and a single CTA.
 */
export function PromoInterstitial({ onSelect }: { onSelect: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const show = () => {
      if (cancelled || document.hidden) return;
      setOpen(true);
    };
    const first = setTimeout(show, FIRST_DELAY);
    const timer = setInterval(show, INTERVAL);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const promo = PROMOS[index % PROMOS.length]!;

  useEffect(() => {
    if (open) void trackPromoEvent("impression", { ...promo, surface: "home_interstitial" });
  }, [open, promo]);

  const close = () => {
    setOpen(false);
    setIndex((i) => i + 1);
  };

  const handleCta = () => {
    void trackPromoEvent("click", { ...promo, surface: "home_interstitial" });
    if (promo.section) onSelect(promo.section);
    close();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={promo.title}
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 overflow-y-auto"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#17171B] p-5 pt-6 text-left shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 rounded-full p-2 text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <img
          src={promo.art}
          alt=""
          aria-hidden
          loading="lazy"
          className="mx-auto mb-3 h-24 w-24 object-contain"
        />
        <h2 className="text-center text-lg font-extrabold text-white">{promo.title}</h2>
        <p className="mt-1 text-center text-sm text-slate-400">{promo.body}</p>

        <div className="mt-5">
          {promo.to ? (
            <Link
              to={promo.to}
              search={promo.search as never}
              onClick={handleCta}
              className="flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-white text-sm font-bold text-slate-900 active:scale-95 transition-transform"
            >
              {promo.cta} <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleCta}
              className="flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-white text-sm font-bold text-slate-900 active:scale-95 transition-transform"
            >
              {promo.cta} <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full text-center text-xs font-semibold text-slate-500"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
