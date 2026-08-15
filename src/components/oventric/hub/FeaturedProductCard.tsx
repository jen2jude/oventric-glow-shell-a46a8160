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
      className="group relative block aspect-[16/10] w-full overflow-hidden rounded-[10px] bg-[#161618] ring-1 ring-white/[0.05] transition-transform active:scale-[0.98]"
    >
      <img src={product.coverUrl || ""} alt={product.name} className="h-full w-full object-cover opacity-80 transition-transform group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      
      <div className="absolute bottom-0 left-0 p-4">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#E5484D] px-2 py-0.5 text-[10px] font-bold text-white">
          <Star className="h-2.5 w-2.5 fill-white" />
          {product.rating.toFixed(1)}
        </div>
        <p className="text-[15px] font-bold text-white line-clamp-1">{product.name}</p>
        <p className="text-[13px] font-semibold text-white/70">{price}</p>
      </div>
    </Link>
  );
}
