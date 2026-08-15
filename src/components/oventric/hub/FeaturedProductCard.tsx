import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import type { ProductDTO } from "@/lib/marketplace.functions";

function reviewCount(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 2400;
  const n = 120 + h;
  return n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

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

  const isDigital = product.kind === "digital";
  const badgeText = isDigital ? "Digital" : product.rating >= 4.8 ? "Best Seller" : "Trending";
  const badgeColor = isDigital
    ? "bg-[#22C55E]"
    : product.rating >= 4.8
      ? "bg-[#8B5CF6]"
      : "bg-[#F59E0B]";

  return (
    <div className="group relative w-full overflow-hidden rounded-[14px] bg-[#121215] border border-white/[0.06] transition-all active:scale-[0.98] flex flex-col">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative aspect-[4/3] w-full overflow-hidden bg-[#17171B]"
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <span
          className={`absolute top-2 left-2 z-10 rounded-full px-2.5 py-[3px] text-[9px] font-bold text-white shadow-lg ${badgeColor}`}
        >
          {badgeText}
        </span>
      </Link>

      <div className="p-3 space-y-2">
        <div className="space-y-0.5">
          <Link to="/product/$id" params={{ id: product.id }}>
            <h3 className="text-[13px] font-bold text-white line-clamp-1 hover:text-[#E5484D] transition-colors">
              {product.name}
            </h3>
          </Link>
          <p className="text-[10.5px] text-white/35 line-clamp-1 font-medium">
            {product.description || "Premium quality, delivered fast."}
          </p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-[14px] font-bold text-white tracking-tight truncate">{price}</p>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#F5A524]">
              <Star className="h-2.5 w-2.5 fill-current" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-white/25 font-medium">({reviewCount(product.id)})</span>
            </div>
          </div>

          <button
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-[10px] bg-white/[0.04] border border-white/[0.06] text-white/60 hover:bg-[#E5484D] hover:text-white hover:border-[#E5484D] transition-all active:scale-90"
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-[15px] h-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
