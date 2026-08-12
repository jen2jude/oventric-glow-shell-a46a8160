import { Megaphone, PlayCircle } from "lucide-react";
import type { AdminAd } from "@/lib/admin/store";
import { ResponsiveImage } from "@/components/ui/responsive-image";

export function AdCard({ ad, variant = "card" }: { ad: AdminAd; variant?: "card" | "banner" }) {
  const isBanner = variant === "banner";
  return (
    <a
      href={ad.clickUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group block bg-[#1E1E24] md:bg-white md:shadow-sm border border-fuchsia-500/30 rounded-xl overflow-hidden hover:border-fuchsia-400/60 transition-colors ${
        isBanner ? "w-full" : "w-[220px] sm:w-[260px] snap-start row-span-2 flex flex-col"
      }`}
    >
      {ad.tier !== "text" && (
        <div
          className={`relative bg-gradient-to-br from-fuchsia-600 to-purple-800 ${isBanner ? "h-24" : "h-32"} overflow-hidden`}
        >
          {ad.mediaUrl && (
            <ResponsiveImage
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={ad.mediaUrl}
              alt={ad.advertiser}
              className="absolute inset-0 w-full h-full object-cover opacity-70"
              loading="lazy"
              decoding="async"
            />
          )}
          {ad.tier === "video" && (
            <PlayCircle className="absolute inset-0 m-auto w-10 h-10 text-white/90 md:text-slate-700" />
          )}
          <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/70 text-fuchsia-300 border border-fuchsia-400/50 rounded px-1.5 py-0.5">
            <Megaphone className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Sponsored
          </span>
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {ad.tier === "text" && (
          <span className="self-start text-[9px] font-black uppercase tracking-widest bg-black/60 text-fuchsia-300 border border-fuchsia-400/50 rounded px-1.5 py-0.5">
            <Megaphone className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Sponsored
          </span>
        )}
        <div className="text-white md:text-slate-900 font-bold text-sm leading-snug line-clamp-2">
          {ad.advertiser}
        </div>
        <div className="text-[11px] text-slate-500 md:text-slate-500 line-clamp-2 flex-1">
          Promoted placement · {ad.tier}
        </div>
        <span className="mt-auto inline-flex items-center justify-center px-3 py-1.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-semibold text-xs rounded-[10px] transition-colors">
          {ad.cta}
        </span>
      </div>
    </a>
  );
}
