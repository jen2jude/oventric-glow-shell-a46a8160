import { Star, ShoppingCart, BadgeCheck } from "lucide-react";
import type { ProductDTO } from "@/lib/marketplace.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export function usePrice() {
  const { baseCurrency } = useOnboarding();
  return (p: ProductDTO) =>
    computeDisplayPrice(
      {
        price_usd: p.priceUSD,
        original_currency: p.originalCurrency,
        original_amount: p.originalAmount,
        fx_snapshot: p.fxSnapshot,
      },
      baseCurrency,
    ).formatted;
}

function Cover({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return <div className={`bg-gradient-to-br from-[#1d1d22] to-[#101014] ${className ?? ""}`} />;
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className ?? ""}`} />;
}

/** Small tile used in horizontal rails ("What's Moving", "New on Oventric"). */
export function TileCard({ product, onClick }: { product: ProductDTO; onClick: () => void }) {
  const price = usePrice();
  return (
    <button type="button" onClick={onClick} className="w-[132px] shrink-0 text-left">
      <div className="h-[132px] w-full overflow-hidden rounded-2xl bg-[#141416]">
        <Cover src={product.coverUrl} alt={product.name} className="h-full w-full" />
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold text-white">{product.name}</p>
      <p className="truncate text-[11.5px] text-white/40">{product.subcategory || product.category}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold text-white">{price(product)}</span>
        {product.rating > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-white/70">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        )}
      </div>
    </button>
  );
}

/** Full-width list row used in "Trending Products". */
export function RowCard({ product, onClick }: { product: ProductDTO; onClick: () => void }) {
  const price = usePrice();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-[#111113] p-3 text-left"
    >
      <div className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-[#18181c]">
        <Cover src={product.coverUrl} alt={product.name} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-white">{product.name}</p>
        <p className="truncate text-[12px] text-white/40">by {product.vendor}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-[13.5px] font-bold text-white">{price(product)}</span>
          {product.rating > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[11.5px] font-semibold text-white/70">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06]">
        <ShoppingCart className="h-4 w-4 text-white/70" />
      </span>
    </button>
  );
}

/** 2-up grid card used for category grids and recommendations. */
export function GridCard({ product, onClick }: { product: ProductDTO; onClick: () => void }) {
  const price = usePrice();
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#141416]">
        <Cover src={product.coverUrl} alt={product.name} className="h-full w-full" />
      </div>
      <p className="mt-2 line-clamp-1 text-[13.5px] font-semibold text-white">{product.name}</p>
      <p className="truncate text-[11.5px] text-white/40">by {product.vendor}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[13.5px] font-bold text-white">{price(product)}</span>
        {product.rating > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-white/70">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        )}
      </div>
    </button>
  );
}

export interface SellerLite {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  verified: boolean;
  rating: number;
  followersCount: number;
  productsCount: number;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

/** Wide shop banner card used in "Featured Shops" / "Recommended Shops". */
export function ShopCard({ seller, onClick }: { seller: SellerLite; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] p-4 text-left"
    >
      {seller.coverUrl && (
        <img src={seller.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0d] via-[#0b0b0d]/85 to-transparent" />
      <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-black ring-1 ring-white/10">
        {seller.avatarUrl ? (
          <img src={seller.avatarUrl} alt={seller.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[15px] font-black text-white">{seller.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate text-[16px] font-bold text-white">{seller.name}</p>
          {seller.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#1D9BF0] text-black" />}
        </div>
        {seller.bio && <p className="truncate text-[12px] text-white/50">{seller.bio}</p>}
        <p className="mt-0.5 text-[11.5px] text-white/40">
          {seller.productsCount} products · {compact(seller.followersCount)} followers
        </p>
      </div>
    </button>
  );
}

/** Section title + "See all". */
export function Rail({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[19px] font-bold tracking-tight text-white">{title}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-[13px] font-semibold text-[#E5484D]">
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
