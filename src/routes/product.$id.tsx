import { useIsAppShell } from "@/hooks/use-launch-context";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Star,
  ShoppingCart,
  Flame,
  Sparkles,
  Loader2,
  Phone,
  MessageCircle,
  MapPin,
  X,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import {
  getProduct,
  logProductContact,
  getProductContact,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import { getProductRating, rateProduct } from "@/lib/product-reviews.functions";
import { supabase } from "@/integrations/supabase/client";
import { computeDisplayPrice, formatMoney } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { ProductComments } from "@/components/oventric/ProductComments";

function ProductRating({
  productId,
  initialAverage,
  initialCount,
  isAppShell,
}: {
  productId: string;
  initialAverage: number;
  initialCount: number;
  isAppShell: boolean;
}) {
  const { require } = useOnboarding();
  const fetchRating = useServerFn(getProductRating);
  const submitRating = useServerFn(rateProduct);
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      try {
        const r = await fetchRating({ data: { productId, userId: uid } });
        if (!cancelled) {
          setAverage(r.average);
          setCount(r.count);
          setMine(r.myRating);
        }
      } catch {
        /* keep server-rendered values */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, fetchRating]);

  const rate = (stars: number) => {
    require(1, () => {
      setSaving(true);
      submitRating({ data: { productId, rating: stars } })
        .then((r) => {
          setAverage(r.average);
          setCount(r.count);
          setMine(r.myRating);
          toast.success("Thanks for rating!");
        })
        .catch((e: Error) => toast.error(e.message || "Could not save your rating"))
        .finally(() => setSaving(false));
    }, "buyer");
  };

  const shown = hover ?? mine ?? Math.round(average);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1 text-sm text-amber-400">
        <Star className="w-4 h-4 fill-current" />
        <span className={`font-semibold ${isAppShell ? "text-amber-400" : "text-slate-900"}`}>{average.toFixed(1)}</span>
        <span className="text-red-500 font-semibold">
          ({count} {count === 1 ? "review" : "reviews"})
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            disabled={saving}
            aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(s)}
            onClick={() => rate(s)}
            className="p-0.5 disabled:opacity-50"
          >
            <Star
              className={`w-5 h-5 transition-transform hover:scale-110 ${s <= shown ? "text-amber-400 fill-current" : isAppShell ? "text-slate-600" : "text-slate-300"}`}
            />
          </button>
        ))}
        <span className={`ml-2 text-[11px] ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
          {mine ? `You rated ${mine}★ — tap to change` : "Tap to rate this product"}
        </span>
      </div>
    </div>
  );
}

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
  // Loader + head run on the server so shared links carry a real preview card.
  ssr: "data-only",
  validateSearch: (s: { qty?: unknown }): { qty?: number } => ({
    qty: Math.max(1, Math.min(20, Number(s?.qty ?? 1) || 1)),
  }),
  loader: async ({ params }) => {
    try {
      const p = await getProduct({ data: { id: params.id } });
      return {
        title: p.name as string,
        description:
          ((p.description as string) || "").slice(0, 155) ||
          "Buy digital assets from Oventric's marketplace.",
        image: (() => {
          const path =
            (p.coverPath as string | null) ?? (p.imagePaths as string[] | undefined)?.[0] ?? null;
          return path ? `https://oventric.com/api/public/img/product-covers/${path}` : null;
        })(),
      };
    } catch {
      return null;
    }
  },
  head: ({ params, loaderData }) => {
    const url = `https://oventric.com/product/${params.id}`;
    const title = loaderData?.title
      ? `${loaderData.title} · Oventric Marketplace`
      : "Product · Oventric Marketplace";
    const description =
      loaderData?.description ?? "Buy digital assets from Oventric's marketplace.";
    const image = loaderData?.image;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const isAppShell = useIsAppShell();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { baseCurrency, require } = useOnboarding();
  const load = useServerFn(getProduct);
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [contactOpen, setContactOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProduct(null);
    setActiveImage(0);
    load({ data: { id } })
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const startCheckout = () => {
    require(2, () => navigate({ to: "/checkout/$id", params: { id }, search: { qty } }), "buyer");
  };

  const openContact = () => {
    require(1, () => setContactOpen(true), "buyer");
  };

  const openSellerChat = () => {
    require(1, () => setChatOpen(true), "buyer");
  };

  return (
    <div className={`min-h-screen overflow-x-hidden ${isAppShell ? "bg-[#121214] text-slate-200" : "bg-[#F7F8FA] text-slate-700"} md:bg-slate-50 md:text-slate-700`}>
      <Header onOpenMessages={() => {}} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 pb-24">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
              // Fire nav event so index route selects Marketplace if we land there.
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("oventric:navigate", { detail: { section: "Marketplace" } }),
                  ),
                40,
              );
            } else {
              navigate({ to: "/" });
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("oventric:navigate", { detail: { section: "Marketplace" } }),
                  ),
                40,
              );
            }
          }}
          className={`inline-flex items-center gap-2 text-sm ${isAppShell ? "text-slate-300 bg-[#1E1E24] border-white/10 hover:text-white" : "text-slate-600 bg-white border-slate-200 hover:text-slate-900 shadow-sm"} md:text-slate-600 md:shadow-sm md:bg-white border md:border-slate-200 rounded-lg px-3 py-2 mb-6`}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>

        {error && (
          <div className={`${isAppShell ? "bg-[#1E1E24] border-red-500/40" : "bg-white border-red-200 shadow-sm"} md:shadow-sm md:bg-white border rounded-xl p-8 text-center`}>
            <div className="text-red-300 font-bold mb-1">Couldn't load product</div>
            <div className="text-sm text-slate-400 md:text-slate-500 mb-4">{error}</div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-semibold text-sm rounded-lg"
            >
              Browse marketplace
            </Link>
          </div>
        )}

        {!product && !error && (
          <div className="flex items-center gap-2 text-slate-400 md:text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading product…
          </div>
        )}

        {product && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              {(() => {
                const gallery =
                  product.kind === "physical" && product.imageUrls.length > 0
                    ? product.imageUrls
                    : product.coverUrl
                      ? [product.coverUrl]
                      : [];
                const cur = gallery[activeImage] ?? gallery[0];
                return (
                  <>
                    <div className={`relative aspect-[4/3] rounded-2xl ${isAppShell ? "bg-white/5" : "bg-white border border-slate-100 shadow-sm"} md:bg-slate-100 overflow-hidden flex items-center justify-center`}>
                      {cur ? (
                        <ResponsiveImage
                          sizes="(min-width: 1024px) 640px, 100vw"
                          src={cur}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                        />
                      ) : (
                        <ShoppingCart className="w-12 h-12 text-white/20" />
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
                            className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${i === activeImage ? "border-emerald-500" : isAppShell ? "border-white/10" : "border-slate-200"} md:border-slate-200`}
                          >
                            <img
                              src={url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
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
                {product.category}
                {product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <h1 className={`text-2xl md:text-3xl font-black ${isAppShell ? "text-white" : "text-slate-900"} md:text-slate-900 mb-2`}>
                {product.name}
              </h1>
              <div className="text-sm text-slate-500 md:text-slate-500 mb-3">
                by{" "}
                <Link
                  to="/profile/$id"
                  params={{ id: product.sellerSlug ?? product.sellerId }}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  {product.vendor}
                </Link>
              </div>
              {product.kind === "physical" && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-300 md:text-slate-600 mb-4">
                  {product.location && (
                    <span className={`inline-flex items-center gap-1 ${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-1`}>
                      <MapPin className="w-3 h-3" /> {product.location}
                    </span>
                  )}
                  {product.condition && (
                    <span className={`${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-1`}>
                      {product.condition}
                    </span>
                  )}
                  {product.brand && (
                    <span className={`${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-1`}>
                      {product.brand}
                    </span>
                  )}
                  {product.negotiable && (
                    <span className={`${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-1`}>
                      Negotiable: {product.negotiable}
                    </span>
                  )}
                  {product.delivery && (
                    <span className={`${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-600 shadow-sm"} md:shadow-sm md:bg-white border md:border-slate-200 rounded px-2 py-1`}>
                      Delivery: {product.delivery}
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <ProductRating
                  productId={product.id}
                  initialAverage={product.rating}
                  initialCount={product.reviews}
                  isAppShell={isAppShell}
                />
              </div>

              <p className={`text-sm ${isAppShell ? "text-slate-300" : "text-slate-600"} md:text-slate-600 leading-relaxed whitespace-pre-wrap mb-6`}>
                {product.description || "No description provided."}
              </p>

              <div className={`${isAppShell ? "bg-[#1E1E24] border-white/10" : "bg-white border-slate-200 shadow-sm"} md:shadow-sm md:bg-white border rounded-xl p-5 mb-4`}>
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    {(() => {
                      const dp = productDisplay(product, baseCurrency);
                      return (
                        <>
                          <div className={`${isAppShell ? "text-white" : "text-slate-900"} md:text-slate-900 font-black text-3xl`}>
                            {dp.formatted}
                          </div>
                          {dp.originalFormatted && (
                            <div className="text-xs text-slate-500 md:text-slate-500 mt-1">
                              Locked at {dp.originalFormatted} {dp.originalCurrency}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {product.kind !== "physical" && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 md:text-slate-500 uppercase tracking-wide">
                        Qty
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={qty}
                        onChange={(e) =>
                          setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                        }
                        className={`w-16 ${isAppShell ? "bg-[#121214] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"} md:bg-slate-50 border md:border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center`}
                      />
                    </div>
                  )}
                </div>
                {product.kind !== "physical" && (
                  <div className={`flex items-center justify-between text-xs ${isAppShell ? "text-slate-500" : "text-slate-400"} md:text-slate-500 mb-4`}>
                    <span>Line total</span>
                    <span className={`${isAppShell ? "text-white" : "text-slate-900"} md:text-slate-900 font-mono`}>
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
                {product.kind !== "physical" && (
                  <button
                    onClick={openSellerChat}
                    className={`mt-2 w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg border font-bold text-sm transition-colors ${isAppShell ? "bg-[#121214] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"} md:bg-white md:text-emerald-600 md:border-emerald-500/40`}
                  >
                    <MessageCircle className="w-4 h-4" /> Chat with seller
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500 md:text-slate-500 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                {product.kind === "physical"
                  ? "Deal directly with the seller — Oventric does not mediate."
                  : "Instant download after payment · Buyer protection covered"}
              </div>
            </div>
            
            {/* Review and Comment Section */}
            <div className="lg:col-span-2">
              <ProductComments productId={product.id} />
            </div>
          </div>
        )}
      </main>
      {product && product.kind !== "physical" && (
        <ProfileMessageModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          recipient={{
            userId: product.sellerId,
            displayName: product.vendor,
            slug: product.sellerSlug,
          }}
          pinnedProduct={{
            id: product.id,
            name: product.name,
            coverUrl: product.coverUrl,
            priceLabel: productDisplay(product, baseCurrency).formatted,
          }}
          initialDraft={`Hi ${product.vendor}! I'm interested in "${product.name}" (${productDisplay(product, baseCurrency).formatted}) on Oventric. Is it available and can you deliver right away?\n\n${typeof window !== "undefined" ? window.location.origin : "https://oventric.com"}/product/${product.id}`}
        />
      )}
      {contactOpen && product && product.kind === "physical" && (
        <ContactSellerModal product={product} onClose={() => setContactOpen(false)} />
      )}
      <MobileNav onCreate={() => {}} active="Market" onSelect={() => navigate({ to: "/" })} />
    </div>
  );
}

function ContactSellerModal({ product, onClose }: { product: ProductDTO; onClose: () => void }) {
  const { baseCurrency } = useOnboarding();
  const logContact = useServerFn(logProductContact);
  const fetchContact = useServerFn(getProductContact);
  const [contact, setContact] = useState<{
    sellerPhone: string | null;
    whatsappNumber: string | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchContact({ data: { productId: product.id } })
      .then((c) => {
        if (!cancelled)
          setContact({ sellerPhone: c.sellerPhone, whatsappNumber: c.whatsappNumber });
      })
      .catch(() => {
        if (!cancelled)
          setContact({ sellerPhone: product.sellerPhone, whatsappNumber: product.whatsappNumber });
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, fetchContact, product.sellerPhone, product.whatsappNumber]);
  const handleContact = (method: "call" | "whatsapp") => {
    void logContact({ data: { productId: product.id, method, note: note?.trim() || null } }).catch(
      () => {},
    );
  };
  const phone = (contact?.sellerPhone ?? product.sellerPhone ?? "").replace(/\D/g, "");
  const wa = (
    contact?.whatsappNumber ??
    contact?.sellerPhone ??
    product.whatsappNumber ??
    product.sellerPhone ??
    ""
  ).replace(/\D/g, "");
  const dp = productDisplay(product, baseCurrency);
  const priceLine =
    product.originalAmount && product.originalCurrency
      ? `${product.originalCurrency} ${product.originalAmount}`
      : `$${product.priceUSD}`;
  // Use the public share endpoint so link previews (WhatsApp, iMessage, etc.)
  // scrape product-specific OG tags including the product cover image.
  const productUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/p/${product.id}`
      : `https://oventric.com/api/public/p/${product.id}`;
  const [note, setNote] = useState("");
  const baseMsg = `Hi! I saw your product "${product.name}" (${priceLine}${product.location ? ` — ${product.location}` : ""}) on Oventric. I would like to purchase it.`;
  const message = `${baseMsg}${note.trim() ? `\n\n${note.trim()}` : ""}\n\n${productUrl}`;
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
  const canCall = phone.length >= 6;
  const cover = (product.kind === "physical" && product.imageUrls[0]) || product.coverUrl;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="slide-up relative w-full max-w-md bg-[#1E1E24] md:shadow-sm md:bg-white border border-white/10 md:border-slate-200 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white md:text-slate-900">Contact the seller</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 md:hover:bg-slate-100 text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live preview card — mirrors what the seller will see */}
        <div className="mb-4 rounded-xl border border-white/10 md:border-slate-200 bg-[#121214] md:bg-slate-50 overflow-hidden">
          <div className="flex gap-3 p-3">
            <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white/5 md:bg-slate-100 flex items-center justify-center">
              {cover ? (
                <img
                  src={cover}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingCart className="w-6 h-6 text-white/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate">
                {product.category}
                {product.subcategory ? ` · ${product.subcategory}` : ""}
              </div>
              <div className="text-sm font-bold text-white md:text-slate-900 truncate">
                {product.name}
              </div>
              <div className="text-xs text-slate-400 md:text-slate-500 truncate">
                by {product.vendor}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-emerald-300 font-black text-sm">{dp.formatted}</div>
                {product.location && (
                  <span className="text-[10px] text-slate-400 md:text-slate-500 inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" /> {product.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 md:border-slate-200 bg-[#0f1012] md:bg-slate-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 md:text-slate-500">
                WhatsApp message preview
              </div>
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
            <pre className="text-xs text-slate-200 md:text-slate-700 whitespace-pre-wrap font-sans leading-relaxed break-words">
              {message}
            </pre>
          </div>
        </div>

        <label className="block text-[11px] uppercase tracking-widest text-slate-400 md:text-slate-500 mb-1">
          Add a note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          rows={2}
          placeholder="e.g. Is this still available? Can I pick up today?"
          className={`w-full mb-4 ${isAppShell ? "bg-[#121214] border-white/10 text-white placeholder:text-slate-600" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"} md:bg-slate-50 border md:border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50`}
        />

        <p className="text-xs text-slate-400 md:text-slate-500 leading-relaxed mb-4">
          You will deal with the seller directly. Take precaution — Oventric does not monitor or
          mediate physical-goods transactions.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={canCall ? `tel:+${phone}` : undefined}
            aria-disabled={!canCall}
            onClick={() => canCall && handleContact("call")}
            className={`inline-flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm ${canCall ? "bg-white/10 md:bg-slate-100 text-white md:text-slate-900 hover:bg-white/15 md:hover:bg-slate-200" : "bg-white/5 md:bg-slate-100 text-slate-500 pointer-events-none"}`}
          >
            <Phone className="w-4 h-4" /> Call Seller
          </a>
          <a
            href={wa ? waUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => wa && handleContact("whatsapp")}
            className={`inline-flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm ${wa ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-white/5 text-slate-500 pointer-events-none"}`}
          >
            <MessageCircle className="w-4 h-4" /> Chat Seller
          </a>
        </div>
      </div>
    </div>
  );
}
