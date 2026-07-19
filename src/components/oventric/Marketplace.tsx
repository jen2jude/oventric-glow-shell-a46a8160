import { useEffect, useMemo, useRef, useState } from "react";
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
  PackageOpen,
  MapPin,
  Package,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useActiveAds } from "@/lib/admin/store";
import { AdCard } from "@/components/oventric/AdCard";
import { listProducts, listMarketplaceCategories, type ProductDTO, type CategoryNode } from "@/lib/marketplace.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";

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

function categoryIcon(cat: string): React.ComponentType<{ className?: string }> {
  return (CATEGORY_META as Record<string, { Icon: React.ComponentType<{ className?: string }> }>)[cat]?.Icon ?? Package;
}

function displayPriceForProduct(p: ProductDTO, viewer: Currency) {
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

type Mode = "digital" | "physical";

export function Marketplace() {
  const { require, baseCurrency } = useOnboarding();
  const navigate = useNavigate();
  const load = useServerFn(listProducts);
  const loadCats = useServerFn(listMarketplaceCategories);
  const [mode, setMode] = useState<Mode>("digital");
  const [activeTab, setActiveTab] = useState<"all" | CategoryKey>("all");
  const [activePhysicalTab, setActivePhysicalTab] = useState<string>("all");
  const [fullCategory, setFullCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [physicalCats, setPhysicalCats] = useState<CategoryNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const refresh = () => {
    setError(null);
    load()
      .then((rows) => setProducts(rows))
      .catch((e: Error) => setError(e.message || "Failed to load"));
  };
  useEffect(refresh, [load]);

  useEffect(() => {
    loadCats()
      .then((rows) => setPhysicalCats((rows ?? []).filter((r) => r.kind === "physical")))
      .catch(() => {});
  }, [loadCats]);


  const onOpenProduct = (p: ProductDTO) => {
    require(1, () => navigate({ to: "/product/$id", params: { id: p.id }, search: { qty: 1 } }), "buyer");
  };

  const marketplaceAds = useActiveAds("marketplace");

  const digital = useMemo(() => (products ?? []).filter((p) => p.kind !== "physical"), [products]);
  const physical = useMemo(() => (products ?? []).filter((p) => p.kind === "physical"), [products]);

  const recommended = useMemo(() => {
    const src = mode === "digital" ? digital : physical;
    const promoted = src.filter((p) => p.promoted);
    const rest = src.filter((p) => !p.promoted).slice(0, 6);
    return [...promoted, ...rest].slice(0, 8);
  }, [digital, physical, mode]);

  // Group physical products by category, ordered by admin sort_order when available.
  const physicalGroups = useMemo(() => {
    const groups = new Map<string, ProductDTO[]>();
    physical.forEach((p) => {
      const key = p.category || "other";
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    });
    if (physicalCats.length === 0) return Array.from(groups.entries());
    const ordered: Array<[string, ProductDTO[]]> = [];
    physicalCats.forEach((c) => {
      const items = groups.get(c.slug);
      if (items && items.length > 0) ordered.push([c.slug, items]);
      groups.delete(c.slug);
    });
    // Any leftover categories the admin hasn't defined
    groups.forEach((items, slug) => ordered.push([slug, items]));
    return ordered;
  }, [physical, physicalCats]);

  const physicalLabel = (slug: string) =>
    physicalCats.find((c) => c.slug === slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

  const visiblePhysicalGroups = useMemo(() => {
    if (activePhysicalTab === "all") return physicalGroups;
    return physicalGroups.filter(([slug]) => slug === activePhysicalTab);
  }, [physicalGroups, activePhysicalTab]);

  const onPillClick = (key: "all" | CategoryKey) => {
    setActiveTab(key);
    if (key === "all") return;
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onPhysicalPillClick = (slug: string) => {
    setActivePhysicalTab(slug);
    if (slug === "all") return;
    const el = sectionRefs.current[`p_${slug}`];
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

  if (!products) return <MarketplaceSkeleton />;

  const ModeToggle = () => (
    <div className="inline-flex items-center gap-2 bg-[#1E1E24] border border-white/10 rounded-full p-1 select-none">
      {(["digital", "physical"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => { setMode(m); setFullCategory(null); setActiveTab("all"); }}
            className={`rounded-full transition-colors ${active ? "rgb-static-border p-[2px]" : "p-0"}`}
          >
            <span
              className={`block px-5 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                active ? "bg-[#1E1E24] text-white" : "text-slate-300 hover:text-white"
              }`}
            >
              {m === "digital" ? "Digital" : "Physical"}
            </span>
          </button>
        );
      })}
    </div>
  );

  // FULL CATEGORY VIEW
  if (fullCategory) {
    const src = mode === "digital" ? digital : physical;
    const items = src.filter((p) => p.category === fullCategory);
    const meta = (CATEGORY_META as Record<string, { label: string; emoji: string } | undefined>)[fullCategory];
    const label = meta?.label ?? fullCategory.charAt(0).toUpperCase() + fullCategory.slice(1);
    const emoji = meta?.emoji ?? "📦";
    return (
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <button
          onClick={() => setFullCategory(null)}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="text-2xl md:text-3xl font-black text-white">{emoji} All {label}</h1>
          <span className="text-xs text-slate-500">{items.length} items</span>
        </div>
        {items.length === 0 ? (
          <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-10 text-center">
            <PackageOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="text-white font-semibold mb-1">No items yet</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} full />
            ))}
          </div>
        )}
      </div>
    );
  }

  const digitalTabs: Array<{ key: "all" | CategoryKey; label: string }> = [
    { key: "all", label: "✨ All" },
    { key: "themes", label: "🎨 Themes" },
    { key: "plugins", label: "🔌 Plugins" },
    { key: "blocks", label: "🧱 HTML Blocks" },
    { key: "scripts", label: "📜 Scripts" },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121214]/90 backdrop-blur border-b border-white/5 flex items-center justify-between gap-3">
        <ModeToggle />
        {mode === "digital" ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {digitalTabs.map((t) => {
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
        ) : (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {[{ slug: "all", name: "✨ All" }, ...physicalCats.map((c) => ({ slug: c.slug, name: c.name }))].map((t) => {
              const active = activePhysicalTab === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => onPhysicalPillClick(t.slug)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                    active
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}

      </div>

      {mode === "digital" ? (
        <div className="px-4 py-6 space-y-10">
          {(Object.keys(CATEGORY_META) as CategoryKey[]).map((cat) => {
            const items = digital.filter((p) => p.category === cat);
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
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
                    <ProductCard key={p.id} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} />
                  ))}
                  {ad && <AdCard ad={ad} />}
                  <ViewMoreButton label={meta.label} onClick={() => setFullCategory(cat)} />
                </div>
              </section>
            );
          })}

          {recommended.length > 0 && (
            <div className="border-t border-white/5 pt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-black text-white">🤖 Recommended For You</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recommended.slice(0, 7).map((p) => (
                  <ProductCard key={p.id} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} full />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 space-y-10">
          {physical.length === 0 ? (
            <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-10 text-center max-w-2xl mx-auto">
              <PackageOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <div className="text-white font-semibold mb-1">No physical goods yet</div>
              <div className="text-sm text-slate-400">Check back soon or be the first to post one.</div>
            </div>
          ) : (
            visiblePhysicalGroups.map(([cat, items]) => (
              <section
                key={cat}
                ref={(el) => { sectionRefs.current[`p_${cat}`] = el; }}
                className="scroll-mt-20"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg md:text-xl font-black text-white capitalize">📦 {physicalLabel(cat)}</h2>
                  <button
                    onClick={() => setFullCategory(cat)}
                    className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    View All →
                  </button>
                </div>
                <div className="grid grid-rows-2 grid-flow-col auto-cols-max overflow-x-auto snap-x scrollbar-none gap-4 pb-4">
                  {items.slice(0, 12).map((p) => (
                    <ProductCard key={p.id} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} />
                  ))}
                  <ViewMoreButton label={physicalLabel(cat)} onClick={() => setFullCategory(cat)} />
                </div>
              </section>
            ))

          )}

          {mode === "physical" && recommended.length > 0 && (
            <div className="border-t border-white/5 pt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-black text-white">🤖 Recommended For You</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recommended.slice(0, 7).map((p) => (
                  <ProductCard key={p.id} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} full />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  p,
  currency,
  onClick,
  full = false,
}: {
  p: ProductDTO;
  currency: Currency;
  onClick: () => void;
  full?: boolean;
}) {
  const Icon = categoryIcon(p.category);
  const cardInner = (
    <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-3 flex flex-col h-full">
      <div className={`relative h-28 rounded-lg bg-gradient-to-br ${p.hue} mb-3 overflow-hidden`}>
        {p.coverUrl ? (
          <ResponsiveImage sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={p.coverUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
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
        {p.kind === "physical" && (
          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-black/60 text-sky-300 border border-sky-400/50 rounded px-1.5 py-0.5">
            Physical
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white text-sm font-semibold truncate">{p.name}</h3>
        <div className="text-[11px] text-slate-500 truncate">{p.vendor}</div>
        {p.kind === "physical" && p.location && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 truncate">
            <MapPin className="w-3 h-3" /> {p.location}
          </div>
        )}
        <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-300">
          <Star className="w-3 h-3 fill-current" />
          <span className="font-semibold">{p.rating.toFixed(1)}</span>
          <span className="text-slate-500">({p.reviews})</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
        <div className="text-white font-black text-base">{displayPriceForProduct(p, currency).formatted}</div>
        <button
          onClick={onClick}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" /> {p.kind === "physical" ? "View" : "Buy"}
        </button>
      </div>
    </div>
  );

  const sizeCls = full ? "w-full" : "w-[220px] sm:w-[260px] snap-start";
  if (p.promoted) {
    return (
      <div className={`${sizeCls} rounded-xl rgb-neon-border-wrapper`}>
        {cardInner}
      </div>
    );
  }
  return <div className={sizeCls}>{cardInner}</div>;
}

function ViewMoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[220px] sm:w-[260px] snap-start row-span-2 flex flex-col items-center justify-center gap-3 rounded-xl bg-[#1E1E24]/40"
      aria-label={`View more ${label}`}
    >
      <span className="rgb-neon-bg rounded-full p-[3px]">
        <span className="w-14 h-14 rounded-full bg-[#1E1E24] flex items-center justify-center">
          <ArrowRight className="w-6 h-6 text-white" />
        </span>
      </span>
      <div className="text-white font-bold text-sm">View More</div>
      <div className="text-xs text-slate-400 px-4 text-center">Browse the full {label} catalog</div>
    </button>
  );
}

function SkeletonPill() {
  return <div className="shrink-0 px-4 py-2 rounded-full bg-white/5 animate-pulse h-9 w-20" />;
}

function SkeletonCard() {
  return (
    <div className="w-[220px] sm:w-[260px] snap-start bg-[#1E1E24] border border-white/5 rounded-xl p-3 animate-pulse">
      <div className="h-28 rounded-lg bg-white/5 mb-3" />
      <div className="h-4 w-3/4 bg-white/5 rounded mb-2" />
      <div className="h-3 w-1/2 bg-white/5 rounded mb-4" />
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
        <div className="h-4 w-16 bg-white/5 rounded" />
        <div className="h-6 w-12 bg-white/5 rounded" />
      </div>
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121214]/90 backdrop-blur border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <SkeletonPill />
          <SkeletonPill />
          <SkeletonPill />
          <SkeletonPill />
        </div>
      </div>
      <div className="px-4 py-6 space-y-10">
        {["a", "b", "c"].map((cat) => (
          <section key={cat}>
            <div className="h-6 w-48 bg-white/5 rounded animate-pulse mb-4" />
            <div className="grid grid-rows-2 grid-flow-col auto-cols-max overflow-x-auto snap-x scrollbar-none gap-4 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={`${cat}-${i}`} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
