import { Star, ShoppingCart, MapPin } from "lucide-react";
import { ProductDTO } from "@/lib/marketplace.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { computeDisplayPrice } from "@/lib/fx-display";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

interface ProductDiscoveryCardProps {
  product: ProductDTO;
  variant?: "standard" | "compact" | "featured";
  onClick?: () => void;
}

export function ProductDiscoveryCard({
  product,
  variant = "standard",
  onClick,
}: ProductDiscoveryCardProps) {
  const { baseCurrency } = useOnboarding();
  const displayPrice = computeDisplayPrice(
    {
      price_usd: product.priceUSD,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    baseCurrency
  );

  if (variant === "featured") {
    return (
      <div
        onClick={onClick}
        className="group relative flex flex-col md:flex-row bg-[#121214] border border-white/5 rounded-2xl overflow-hidden cursor-pointer hover:border-red-500/30 transition-all duration-300 shadow-2xl"
      >
        <div className="w-full md:w-3/5 aspect-video md:aspect-auto overflow-hidden relative">
          <ResponsiveImage
            src={product.coverUrl ?? ""}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {product.promoted && (
            <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg">
              Featured
            </div>
          )}
        </div>
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-center space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-black text-red-500 uppercase tracking-widest">
              {product.category}
            </span>
            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">
              {product.name}
            </h3>
          </div>
          <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-center justify-between pt-4">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">
                {displayPrice.formatted}
              </span>
              {product.rating > 0 && (
                <div className="flex items-center gap-1 text-emerald-400 mt-1">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-xs font-bold">{product.rating} ({product.reviews})</span>
                </div>
              )}
            </div>
            <button className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-3 rounded-full text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Get Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        onClick={onClick}
        className="group flex items-center gap-4 bg-[#121214] p-4 rounded-3xl border border-white/5 cursor-pointer hover:border-red-500/20 transition-all shadow-xl"
      >
        <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-slate-900">
          <ResponsiveImage
            src={product.coverUrl ?? ""}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="text-base font-black text-white truncate group-hover:text-red-500 transition-colors uppercase italic tracking-tighter">
            {product.name}
          </h4>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
            by {product.vendor}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-black text-white">
              {displayPrice.formatted}
            </span>
            <div className="flex items-center gap-1 text-emerald-400">
              <Star className="w-2.5 h-2.5 fill-current" />
              <span className="text-[10px] font-bold">{product.rating || 4.8}</span>
            </div>
          </div>
        </div>
        <button className="p-3 bg-white/5 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
          <ShoppingCart className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group flex flex-col bg-[#121214] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-red-500/20 transition-all"
    >
      <div className="aspect-square overflow-hidden relative bg-slate-900 rounded-3xl">
        <ResponsiveImage
          src={product.coverUrl ?? ""}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
           <button className="w-full bg-white text-black font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-transform">
             View Product
           </button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-black text-white line-clamp-1 group-hover:text-red-500 transition-colors uppercase italic tracking-tighter">
            {product.name}
          </h3>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base font-black text-white">
            {displayPrice.formatted}
          </span>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            {product.rating}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] font-black text-slate-500 uppercase truncate">
            {product.vendor}
          </span>
          {product.kind === 'physical' && product.location && (
             <span className="text-[10px] text-slate-600 flex items-center gap-0.5 truncate border-l border-white/10 pl-2">
               <MapPin className="w-2.5 h-2.5" />
               {product.location}
             </span>
          )}
        </div>
      </div>
    </div>
  );
}
