import { Search, ShoppingBag, ArrowRight } from "lucide-react";
import { ResponsiveImage } from "@/components/ui/responsive-image";

interface FeaturedHeroProps {
  title: string;
  description: string;
  image: string;
  ctaText: string;
  onCtaClick: () => void;
  accentTitle?: string;
}

export function FeaturedHero({
  title,
  description,
  image,
  ctaText,
  onCtaClick,
  accentTitle,
}: FeaturedHeroProps) {
  return (
    <div className="relative w-full h-[400px] md:h-[500px] rounded-[32px] overflow-hidden group">
      <ResponsiveImage
        src={image}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
      
      <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-16 max-w-2xl space-y-6">
        {accentTitle && (
          <div className="inline-flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-full w-fit">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              {accentTitle}
            </span>
          </div>
        )}
        
        <h1 className="text-4xl md:text-6xl font-black text-white leading-[0.9] tracking-tighter uppercase italic">
          {title}
        </h1>
        
        <p className="text-lg text-slate-200/80 font-medium leading-relaxed max-w-md">
          {description}
        </p>
        
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={onCtaClick}
            className="bg-white text-black hover:bg-red-600 hover:text-white font-black px-8 py-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-sm uppercase tracking-widest shadow-2xl"
          >
            {ctaText}
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <button className="bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 font-black px-8 py-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-sm uppercase tracking-widest">
            <ShoppingBag className="w-5 h-5" />
            Browse More
          </button>
        </div>
      </div>
      
      {/* Decorative Grid */}
      <div className="absolute bottom-8 right-8 hidden lg:grid grid-cols-2 gap-2 opacity-40">
        {[1,2,3,4].map(i => (
          <div key={i} className="w-12 h-12 border border-white/20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
