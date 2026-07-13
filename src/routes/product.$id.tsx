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
  const [contactOpen, setContactOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProduct(null);
    setActiveImage(0);
    load({ data: { id } })
      .then((p) => { if (!cancelled) setProduct(p); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Failed to load"); });
    return () => { cancelled = true; };
  }, [id, load]);

  const startCheckout = () => {
    require(2, () => navigate({ to: "/checkout/$id", params: { id }, search: { qty } }), "buyer");
  };

  const openContact = () => {
    require(1, () => setContactOpen(true), "buyer");
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
              {(() => {
                const gallery = product.kind === "physical" && product.imageUrls.length > 0
                  ? product.imageUrls
                  : product.coverUrl ? [product.coverUrl] : [];
                const cur = gallery[activeImage] ?? gallery[0];
                return (
                  <>
                    <div className={`relative aspect-[4/3] rounded-2xl bg-gradient-to-br ${product.hue} overflow-hidden`}>
                      {cur ? (
                        <ResponsiveImage sizes="(min-width: 1024px) 640px, 100vw" src={cur} alt={product.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 55%)" }} />
                      )}
                      {product.promoted && (
                        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-2 py-0.5">
                          <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Promoted
                        </span>
                      )}
                    </div>
                    {gallery.length > 1 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
                        {gallery.map((url, i) => (
                          <button
                            key={url}
                            onClick={() => setActiveImage(i)}
                            className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${i === activeImage ? "border-emerald-500" : "border-white/10"}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
                {product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2">{product.name}</h1>
              <div className="text-sm text-slate-500 mb-3">by <span className="text-slate-300">{product.vendor}</span></div>
              {product.kind === "physical" && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-300 mb-4">
                  {product.location && <span className="inline-flex items-center gap-1 bg-[#1E1E24] border border-white/10 rounded px-2 py-1"><MapPin className="w-3 h-3" /> {product.location}</span>}
                  {product.condition && <span className="bg-[#1E1E24] border border-white/10 rounded px-2 py-1">{product.condition}</span>}
                  {product.brand && <span className="bg-[#1E1E24] border border-white/10 rounded px-2 py-1">{product.brand}</span>}
                  {product.negotiable && <span className="bg-[#1E1E24] border border-white/10 rounded px-2 py-1">Negotiable: {product.negotiable}</span>}
                  {product.delivery && <span className="bg-[#1E1E24] border border-white/10 rounded px-2 py-1">Delivery: {product.delivery}</span>}
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-amber-300 mb-5">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-semibold">{product.rating.toFixed(1)}</span>
                <span className="text-slate-500">({product.reviews} reviews)</span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap mb-6">{product.description || "No description provided."}</p>

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
                  {product.kind !== "physical" && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 uppercase tracking-wide">Qty</label>
                      <input type="number" min={1} max={20} value={qty}
                        onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                        className="w-16 bg-[#121214] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center" />
                    </div>
                  )}
                </div>
                {product.kind !== "physical" && (
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                    <span>Line total</span>
                    <span className="text-white font-mono">
                      {formatMoney(productDisplay(product, baseCurrency).value * qty, baseCurrency)}
                    </span>
                  </div>
                )}
                <button
                  onClick={product.kind === "physical" ? openContact : startCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" /> Buy Now
                </button>
              </div>

              <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                {product.kind === "physical"
                  ? "Deal directly with the seller — Oventric does not mediate."
                  : "Instant download after payment · Buyer protection covered"}
              </div>
            </div>
          </div>
        )}
      </main>
      {contactOpen && product && product.kind === "physical" && (
        <ContactSellerModal product={product} onClose={() => setContactOpen(false)} />
      )}
      <MobileNav onCreate={() => {}} active="Market" onSelect={() => navigate({ to: "/" })} />
    </div>
  );
}

function ContactSellerModal({ product, onClose }: { product: ProductDTO; onClose: () => void }) {
  const { baseCurrency } = useOnboarding();
  const phone = (product.sellerPhone ?? "").replace(/\D/g, "");
  const wa = (product.whatsappNumber ?? phone).replace(/\D/g, "");
  const dp = productDisplay(product, baseCurrency);
  const priceLine = product.originalAmount && product.originalCurrency
    ? `${product.originalCurrency} ${product.originalAmount}`
    : `$${product.priceUSD}`;
  const productUrl = typeof window !== "undefined"
    ? `${window.location.origin}/product/${product.id}`
    : `https://oventric.com/product/${product.id}`;
  const [note, setNote] = useState("");
  const baseMsg = `Hi! I saw your product "${product.name}" (${priceLine}${product.location ? ` — ${product.location}` : ""}) on Oventric. I would like to purchase it.`;
  const message = `${baseMsg}${note.trim() ? `\n\n${note.trim()}` : ""}\n\n${productUrl}`;
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
  const canCall = phone.length >= 6;
  const cover = (product.kind === "physical" && product.imageUrls[0]) || product.coverUrl;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="slide-up relative w-full max-w-md bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">Contact the seller</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Live preview card — mirrors what the seller will see */}
        <div className="mb-4 rounded-xl border border-white/10 bg-[#121214] overflow-hidden">
          <div className="flex gap-3 p-3">
            <div className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br ${product.hue}`}>
              {cover ? (
                <img src={cover} alt={product.name} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate">
                {product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <div className="text-sm font-bold text-white truncate">{product.name}</div>
              <div className="text-xs text-slate-400 truncate">by {product.vendor}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-emerald-300 font-black text-sm">{dp.formatted}</div>
                {product.location && (
                  <span className="text-[10px] text-slate-400 inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" /> {product.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 bg-[#0f1012] px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">WhatsApp message preview</div>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                    toast.success("WhatsApp message copied");
                  } catch {
                    toast.error("Could not copy message");
                  }
                }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 hover:text-emerald-200"
              >
                <Copy className="w-3 h-3" /> Copy message
              </button>
            </div>
            <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed break-words">{message}</pre>
          </div>
        </div>

        <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">Add a note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          rows={2}
          placeholder="e.g. Is this still available? Can I pick up today?"
          className="w-full mb-4 bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
        />

        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          You will deal with the seller directly. Take precaution — Oventric does not monitor or mediate physical-goods transactions.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={canCall ? `tel:+${phone}` : undefined}
            aria-disabled={!canCall}
            className={`inline-flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm ${canCall ? "bg-white/10 text-white hover:bg-white/15" : "bg-white/5 text-slate-500 pointer-events-none"}`}
          >
            <Phone className="w-4 h-4" /> Call Seller
          </a>
          <a
            href={wa ? waUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm ${wa ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-white/5 text-slate-500 pointer-events-none"}`}
          >
            <MessageCircle className="w-4 h-4" /> Chat Seller
          </a>
        </div>
      </div>
    </div>
  );
}

