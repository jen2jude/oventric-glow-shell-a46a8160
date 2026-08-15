import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
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

  return (
    <Link 
      to="/product/$id" 
      params={{ id: product.id }}
      className="group relative block aspect-[16/10] w-full overflow-hidden rounded-[10px] bg-[#141416] border border-white/[0.06] transition-all active:scale-[0.98]"
    >
      <img src={product.coverUrl || ""} alt={product.name} className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/20 to-transparent" />
      
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[17px] font-black uppercase tracking-tight text-white line-clamp-1">{product.name}</p>
            <p className="text-[14px] font-black text-[#E5484D] tracking-tighter">{price}</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5484D] px-2.5 py-1 text-[10px] font-black text-white shadow-[0_0_15px_rgba(229,72,77,0.3)]">
            <Star className="h-2.5 w-2.5 fill-white" />
            {product.rating.toFixed(1)}
          </div>
        </div>
      </div>
    </Link>
  );
}
