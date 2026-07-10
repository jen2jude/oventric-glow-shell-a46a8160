import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ArrowLeft,
  Star,
  ShoppingCart,
  Palette,
  Plug,
  Blocks,
  Code2,
  Flame,
  Loader2,
  PackageOpen,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useActiveAds } from "@/lib/admin/store";
import { AdCard } from "@/components/oventric/AdCard";
import { listProducts, FX_FROM_USD, type ProductDTO } from "@/lib/marketplace.functions";

type CategoryKey = "themes" | "plugins" | "blocks" | "scripts";

const CATEGORY_META: Record<
  CategoryKey,
  { label: string; emoji: string; title: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  themes: { label: "Themes", emoji: "🎨", title: "🔥 Featured Themes", Icon: Palette },
  plugins: { label: "Plugins", emoji: "🔌", title: "⚙️ Popular Plugins", Icon: Plug },
  blocks: { label: "HTML Blocks", emoji: "🧱", title: "🧱 Trending HTML Blocks", Icon: Blocks },
  scripts: { label: "Scripts", emoji: "📜", title: "📜 Top Scripts", Icon: Code2 },
};

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

function formatPrice(usd: number, cur: Currency) {
  const val = usd * FX_FROM_USD[cur];
  const rounded = cur === "USD" ? val.toFixed(2) : Math.round(val).toLocaleString();
  return `${CURRENCY_SYMBOL[cur]}${rounded}`;
}

export function Marketplace() {
  const { require, baseCurrency } = useOnboarding();
  const navigate = useNavigate();
  const load = useServerFn(listProducts);
  const [activeTab, setActiveTab] = useState<"all" | CategoryKey>("all");
  const [fullCategory, setFullCategory] = useState<CategoryKey | null>(null);
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const refresh = () => {
    setError(null);
    load()
      .then((rows) => setProducts(rows))
      .catch((e: Error) => setError(e.message || "Failed to load"));
  };
  useEffect(refresh, [load]);

  const onBuy = (p: ProductDTO) => {
    // Product detail is public; still route through auth-on-action for a smoother funnel.
    require(1, () => navigate({ to: "/product/$id", params: { id: p.id }, search: { qty: 1 } }), "buyer");
  };

  const marketplaceAds = useActiveAds("marketplace");

  const recommended = useMemo(() => {
    if (!products) return [];
    const promoted = products.filter((p) => p.promoted);
    const rest = products.filter((p) => !p.promoted).slice(0, 6);
    return [...promoted, ...rest].slice(0, 8);
  }, [products]);

  const onPillClick = (key: "all" | CategoryKey) => {
    setActiveTab(key);
    if (key === "all") return;
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 py-10 text-center">
        <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-8">
          <div className="text-red-300 font-bold mb-1">Couldn't load marketplace</div>
          <div className="text-sm text-slate-400 mb-4">{error}</div>
          <button onClick={refresh} className="px-4 py-2 bg-emerald-500 text-black font-semibold text-sm rounded-lg">Try again</button>
        </div>
      </div>
    );
  }

  if (!products) {
    return <MarketplaceSkeleton />;
  }

  if (products.length === 0) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center mx-auto mb-5">
          <PackageOpen className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-xl font-black text-white mb-1">No listings yet</h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
          The marketplace is empty right now. Be the first to publish a digital asset and start earning.
        </p>
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
        >
          Open Content Factory
        </button>
      </div>
    );
  }

  if (fullCategory) {
    const meta = CATEGORY_META[fullCategory];
    const items = products.filter((p) => p.category === fullCategory);
    return (
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <button
          onClick={() => setFullCategory(null)}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="text-2xl md:text-3xl font-black text-white">{meta.emoji} All {meta.label}</h1>
          <span className="text-xs text-slate-500">{items.length} items</span>
        </div>
        {items.length === 0 ? (
          <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-10 text-center">
            <PackageOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="text-white font-semibold mb-1">No {meta.label.toLowerCase()} yet</div>
            <div className="text-sm text-slate-400">
              Nothing in this category. Check back later or browse other sections.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={() => onBuy(p)} full />
            ))}
          </div>
        )}
      </div>
    );
  }

  const tabs: Array<{ key: "all" | CategoryKey; label: string }> = [
    { key: "all", label: "✨ All" },
    { key: "themes", label: "🎨 Themes" },
    { key: "plugins", label: "🔌 Plugins" },
    { key: "blocks", label: "🧱 HTML Blocks" },
    { key: "scripts", label: "📜 Scripts" },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="sticky top-0 z-30 -mx-0 px-4 py-3 bg-[#121214]/90 backdrop-blur border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onPillClick(t.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-6 space-y-10">
        {(Object.keys(CATEGORY_META) as CategoryKey[]).map((cat) => {
          const meta = CATEGORY_META[cat];
          const items = products.filter((p) => p.category === cat);
          if (items.length === 0) return null;
          const ad = marketplaceAds.find((a) => a.id.charCodeAt(3) % 4 === Object.keys(CATEGORY_META).indexOf(cat));
          return (
            <section
              key={cat}
              ref={(el) => { sectionRefs.current[cat] = el; }}
              className="scroll-mt-20"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-black text-white truncate">{meta.title}</h2>
                <button
                  onClick={() => setFullCategory(cat)}
                  className="text-sm text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0"
                >
                  View All →
                </button>
              </div>

              <div className="grid grid-rows-2 grid-flow-col auto-cols-max overflow-x-auto snap-x scrollbar-none gap-4 pb-4">
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={() => onBuy(p)} />
                ))}
                {ad && <AdCard ad={ad} />}
                <ViewMoreCard label={meta.label} onClick={() => setFullCategory(cat)} />
              </div>
            </section>
          );
        })}

        {recommended.length > 0 && (
          <div className="border-t border-white/5 pt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-black text-white">🤖 Recommended For You</h2>
              <span className="text-xs text-slate-500 hidden sm:inline">Curated by trending intent</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommended.slice(0, 7).map((p) => (
                <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={() => onBuy(p)} full />
              ))}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  p,
  currency,
  onBuy,
  full = false,
}: {
  p: ProductDTO;
  currency: Currency;
  onBuy: () => void;
  full?: boolean;
}) {
  const Icon = CATEGORY_META[p.category].Icon;
  return (
    <div
      className={`${
        full ? "w-full" : "w-[220px] sm:w-[260px] snap-start"
      } bg-[#1E1E24] border border-white/5 rounded-xl p-3 flex flex-col ${
        p.promoted ? "rgb-pulse-glow" : ""
      }`}
    >
      <div className={`relative h-28 rounded-lg bg-gradient-to-br ${p.hue} mb-3 overflow-hidden`}>
        {p.coverUrl ? (
          <img src={p.coverUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)"
          }} />
        )}
        <Icon className="absolute right-2 bottom-2 w-6 h-6 text-white/70 drop-shadow" />
        {p.promoted && (
          <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-1.5 py-0.5">
            <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" />
            Promoted
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white text-sm font-semibold truncate">{p.name}</h3>
        <div className="text-[11px] text-slate-500 truncate">{p.vendor}</div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-300">
          <Star className="w-3 h-3 fill-current" />
          <span className="font-semibold">{p.rating.toFixed(1)}</span>
          <span className="text-slate-500">({p.reviews})</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
        <div className="text-white font-black text-base">{formatPrice(p.priceUSD, currency)}</div>
        <button
          onClick={onBuy}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" /> Buy
        </button>
      </div>
    </div>
  );
}

function ViewMoreCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[220px] sm:w-[260px] snap-start row-span-2 rgb-neon-border-wrapper rounded-xl"
    >
      <div className="h-full w-full bg-[#1E1E24]/70 backdrop-blur rounded-[10px] flex flex-col items-center justify-center gap-3 p-6 text-center hover:bg-[#1E1E24] transition-colors">
        <span className="w-14 h-14 rounded-full rgb-neon-bg flex items-center justify-center">
          <span className="w-12 h-12 rounded-full bg-[#1E1E24] flex items-center justify-center">
            <ArrowRight className="w-6 h-6 text-white" />
          </span>
        </span>
        <div className="text-white font-bold">View More</div>
        <div className="text-xs text-slate-400">Browse the full {label} catalog</div>
      </div>
    </button>
  );
}

