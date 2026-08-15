import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import type { ProductDTO } from "@/lib/marketplace.functions";

export function FeaturedProductCard({ product }: { product: ProductDTO }) {
  const { baseCurrency } = useOnboarding();
  const price = computeDisplayPrice(
    {
      price_usd: product.priceUSD,
      original_currency: product.originalCurrency,
      original_amount: product.originalAmount,
      fx_snapshot: product.fxSnapshot,
    },
    baseCurrency,
  ).formatted;

  const isDigital = product.isDigital || product.title.toLowerCase().includes("pro");
  const badgeText = isDigital ? "Digital" : product.rating >= 4.8 ? "Best Seller" : "Trending";
  const badgeColor = isDigital ? "bg-[#30A46C]" : product.rating >= 4.8 ? "bg-[#E5484D]" : "bg-[#F5A524]";

  return (
    <div className="group relative w-full overflow-hidden rounded-[10px] bg-[#141416] border border-white/[0.06] transition-all active:scale-[0.98] flex flex-col">
      <Link to="/product/$id" params={{ id: product.id }} className="relative aspect-square w-full overflow-hidden">
        <img 
          src={product.coverUrl || ""} 
          alt={product.name} 
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
        />
        <div className={`absolute top-2.5 left-2.5 z-10 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-lg ${badgeColor}`}>
          {badgeText}
        </div>
      </Link>
      
      <div className="p-3.5 space-y-2.5">
        <div className="space-y-0.5">
          <Link to="/product/$id" params={{ id: product.id }}>
            <h3 className="text-[14px] font-bold text-white line-clamp-1 hover:text-[#E5484D] transition-colors">
              {product.name}
            </h3>
          </Link>
          <p className="text-[11px] text-white/40 line-clamp-1 font-medium">
            {product.description || "Premium quality product."}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[15px] font-black text-white tracking-tight">{price}</p>
            <div className="flex items-center gap-1 text-[10px] font-bold text-[#F5A524]">
              <Star className="h-2.5 w-2.5 fill-current" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-white/20 font-medium">({Math.floor(Math.random() * 1000) + 100})</span>
            </div>
          </div>
          
          <button 
            className="h-8 w-8 flex items-center justify-center rounded-[10px] bg-white/[0.03] border border-white/5 text-white/60 hover:bg-[#E5484D] hover:text-white hover:border-[#E5484D] transition-all active:scale-90"
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
