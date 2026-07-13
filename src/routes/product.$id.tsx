import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Star, ShoppingCart, Flame, Sparkles, Loader2, Phone, MessageCircle, MapPin, X, AlertTriangle } from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getProduct, type ProductDTO } from "@/lib/marketplace.functions";
import { computeDisplayPrice, formatMoney } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";

function productDisplay(p: ProductDTO, viewer: Currency) {
  return computeDisplayPrice(
    {
      price_usd: p.priceUSD,
      original_currency: p.originalCurrency,
      original_amount: p.originalAmount,
      fx_snapshot: p.fxSnapshot,
    },
    viewer,
  );
}

export const Route = createFileRoute("/product/$id")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ qty: Math.max(1, Math.min(20, Number(s?.qty ?? 1) || 1)) }),
  head: () => ({
    meta: [
      { title: "Product · Oventric Marketplace" },
      { name: "description", content: "Buy digital assets from Oventric's marketplace." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { baseCurrency, require } = useOnboarding();
  const load = useServerFn(getProduct);
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProduct(null);
    load({ data: { id } })
      .then((p) => { if (!cancelled) setProduct(p); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Failed to load"); });
    return () => { cancelled = true; };
  }, [id, load]);

  const startCheckout = () => {
    require(2, () => navigate({ to: "/checkout/$id", params: { id }, search: { qty } }), "buyer");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#121214] text-slate-200">
      <Header onOpenMessages={() => {}} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 pb-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

        {error && (
          <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-8 text-center">
            <div className="text-red-300 font-bold mb-1">Couldn't load product</div>
            <div className="text-sm text-slate-400 mb-4">{error}</div>
            <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-semibold text-sm rounded-lg">
              Browse marketplace
            </Link>
          </div>
        )}

        {!product && !error && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading product…
          </div>
        )}

        {product && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className={`relative aspect-[4/3] rounded-2xl bg-gradient-to-br ${product.hue} overflow-hidden`}>
                {product.coverUrl ? (
                  <ResponsiveImage sizes="(min-width: 1024px) 640px, 100vw" src={product.coverUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover"  loading="lazy" decoding="async" />
                ) : (
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 55%)" }} />
                )}
                {product.promoted && (
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-2 py-0.5">
                    <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Promoted
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">{product.category}</div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2">{product.name}</h1>
              <div className="text-sm text-slate-500 mb-3">by <span className="text-slate-300">{product.vendor}</span></div>
              <div className="flex items-center gap-1 text-sm text-amber-300 mb-5">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-semibold">{product.rating.toFixed(1)}</span>
                <span className="text-slate-500">({product.reviews} reviews)</span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-6">{product.description || "No description provided."}</p>

              <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 mb-4">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    {(() => {
                      const dp = productDisplay(product, baseCurrency);
                      return (
                        <>
                          <div className="text-white font-black text-3xl">{dp.formatted}</div>
                          {dp.originalFormatted && (
                            <div className="text-xs text-slate-500 mt-1">
                              Locked at {dp.originalFormatted} {dp.originalCurrency}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 uppercase tracking-wide">Qty</label>
                    <input type="number" min={1} max={20} value={qty}
                      onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                      className="w-16 bg-[#121214] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span>Line total</span>
                  <span className="text-white font-mono">
                    {formatMoney(productDisplay(product, baseCurrency).value * qty, baseCurrency)}
                  </span>
                </div>
                <button
                  onClick={startCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" /> Buy Now
                </button>
              </div>

              <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Instant download after payment · Buyer protection covered
              </div>
            </div>
          </div>
        )}
      </main>
      <MobileNav onCreate={() => {}} active="Market" onSelect={() => navigate({ to: "/" })} />
    </div>
  );
}
