import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, LayoutGrid, Search, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  listProducts,
  listMarketplaceCategories,
  getMarketplaceDiscovery,
  type ProductDTO,
  type CategoryNode,
} from "@/lib/marketplace.functions";
import { CategoryDiscoverySheet } from "./marketplace-discovery/CategoryDiscoverySheet";
import { GridCard, Rail, RowCard, ShopCard, TileCard, type SellerLite } from "./marketplace-discovery/cards";
import oventricFull from "@/assets/oventric-full.asset.json";

type Mode = "all" | "digital" | "physical";

interface Discovery {
  featured: ProductDTO[];
  trending: ProductDTO[];
  newArrivals: ProductDTO[];
  topSellers: SellerLite[];
  categoryCounts: Record<string, number>;
}

export function Marketplace() {
  const { require } = useOnboarding();
  const navigate = useNavigate();

  const loadDiscovery = useServerFn(getMarketplaceDiscovery);
  const loadProducts = useServerFn(listProducts);
  const loadCats = useServerFn(listMarketplaceCategories);

  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [mode, setMode] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryNode | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, p, c] = await Promise.all([loadDiscovery(), loadProducts(), loadCats()]);
        setDiscovery(d as Discovery);
        setProducts(p ?? []);
        setCats(c ?? []);
      } catch (e) {
        console.error("marketplace load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDiscovery, loadProducts, loadCats]);

  const openProduct = (p: ProductDTO) =>
    require(1, () => navigate({ to: "/product/$id", params: { id: p.id }, search: { qty: 1 } }), "buyer");
  const openShop = (slug: string) => navigate({ to: "/shop/$id", params: { id: slug } });

  const byMode = useMemo(
    () => (mode === "all" ? products : products.filter((p) => p.kind === mode)),
    [products, mode],
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byMode;
    return byMode.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [byMode, query]);

  const categoryProducts = useMemo(() => {
    if (!activeCategory) return [];
    const slugs = new Set<string>([activeCategory.slug, ...activeCategory.children.map((c) => c.slug)]);
    return products.filter((p) => slugs.has(p.category) || (p.subcategory && slugs.has(p.subcategory)));
  }, [products, activeCategory]);

  /** Root categories that actually have live products — used for the trailing grids. */
  const categoryBuckets = useMemo(() => {
    return cats
      .filter((c) => mode === "all" || c.kind === mode)
      .map((c) => {
        const slugs = new Set<string>([c.slug, ...c.children.map((k) => k.slug)]);
        const items = products.filter((p) => slugs.has(p.category) || (p.subcategory && slugs.has(p.subcategory)));
        return { cat: c, items };
      })
      .filter((b) => b.items.length > 0)
      .slice(0, 8);
  }, [cats, products, mode]);

  const recommendedProducts = useMemo(() => [...byMode].sort(() => 0).slice(0, 8), [byMode]);
  const sellers = discovery?.topSellers ?? [];

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (loading) return <MarketplaceSkeleton />;

  const featured = discovery?.featured?.[0] ?? discovery?.trending?.[0] ?? null;

  return (
    <div ref={topRef} className="min-h-full bg-[#0A0A0B] pb-24 text-white">
      <div className="mx-auto w-full max-w-[720px]">
        {/* Header */}
        <header
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 pb-2"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
        >
          <img src={oventricFull.url} alt="Oventric" className="h-7 w-auto" />
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="relative grid h-10 w-10 shrink-0 place-items-center"
            aria-label="Your orders"
          >
            <ShoppingCart className="h-6 w-6 text-white" />
          </button>
        </header>

        {activeCategory ? (
          <CategoryResults
            category={activeCategory}
            items={categoryProducts}
            onBack={() => setActiveCategory(null)}
            onOpenProduct={openProduct}
          />
        ) : (
          <>
            {/* Title */}
            <div className="px-4 pt-2">
              <h1 className="text-[38px] font-bold leading-[1.05] tracking-tight text-white">Marketplace</h1>
              <p className="mt-2 max-w-[19rem] text-[15px] leading-snug text-white/45">
                Discover people, products and opportunities.
              </p>
            </div>

            {/* Search */}
            <div className="px-4 pt-5">
              <div className="flex items-center gap-3 rounded-2xl bg-[#141416] px-4 py-3.5">
                <Search className="h-[18px] w-[18px] shrink-0 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, shops..."
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
                />
                <SlidersHorizontal className="h-[18px] w-[18px] shrink-0 text-white/40" />
              </div>
            </div>

            {/* Filter pills */}
            <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
              <Pill active={mode === "all"} onClick={() => setMode("all")} label="All" />
              <Pill active={mode === "digital"} onClick={() => setMode("digital")} label="Digital" />
              <Pill active={mode === "physical"} onClick={() => setMode("physical")} label="Physical" />
              <Pill
                active={false}
                onClick={() => setShowCategories(true)}
                label="Categories"
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
              />
            </div>

            {query.trim() ? (
              <section className="px-4 pt-6">
                <h2 className="mb-3 text-[19px] font-bold text-white">
                  {searched.length} result{searched.length === 1 ? "" : "s"}
                </h2>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                  {searched.map((p) => (
                    <GridCard key={p.id} product={p} onClick={() => openProduct(p)} />
                  ))}
                </div>
              </section>
            ) : (
              <div className="space-y-8 pt-6">
                {/* Featured carousel */}
                {discovery && discovery.featured.length > 0 && (
                  <div className="px-4">
                    <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
                      {discovery.featured.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openProduct(item)}
                          className="relative h-[190px] w-full min-w-full shrink-0 snap-center overflow-hidden rounded-[32px] bg-[#1A1A1E] text-left ring-1 ring-white/5"
                        >
                          {item.coverUrl && (
                            <img
                              src={item.coverUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-110"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                          <div className="relative flex h-full flex-col justify-end p-6 pb-7">
                            <span className="mb-2 w-fit rounded-lg bg-[#E5484D] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                              {item.kind === "digital" ? "Digital" : item.kind === "physical" ? "Physical" : "Featured"}
                            </span>
                            <h3 className="line-clamp-2 text-[22px] font-bold leading-[1.1] tracking-tight text-white drop-shadow-md">
                              {item.name}
                            </h3>
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Dots indicator */}
                    <div className="mt-3 flex justify-center gap-1.5">
                      {discovery.featured.slice(0, 5).map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === 0 ? "w-4 bg-[#E5484D]" : "w-1.5 bg-white/20"}`} />
                      ))}
                    </div>
                  </div>
                )}

                {/* What's Moving */}
                {discovery && discovery.trending.length > 0 && (
                  <Rail title="What's Moving 🔥" onSeeAll={() => setShowCategories(true)}>
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
                      {discovery.trending.slice(0, 10).map((p) => (
                        <TileCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Trending Products */}
                {discovery && discovery.trending.length > 0 && (
                  <Rail title="Trending Products" onSeeAll={scrollTop}>
                    <div className="space-y-2.5 px-4">
                      {discovery.trending.slice(0, 4).map((p) => (
                        <RowCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* New on Oventric */}
                {discovery && discovery.newArrivals.length > 0 && (
                  <Rail title="New on Oventric" onSeeAll={scrollTop}>
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
                      {discovery.newArrivals.slice(0, 10).map((p) => (
                        <TileCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Featured Shops */}
                {sellers.length > 0 && (
                  <Rail title="Featured Shops">
                    <div className="space-y-3 px-4">
                      {sellers.slice(0, 2).map((s) => (
                        <ShopCard key={s.id} seller={s} onClick={() => openShop(s.slug)} />
                      ))}
                    </div>
                  </Rail>
                )}
                
                {/* Top Sellers */}
                {sellers.length > 0 && (
                  <Rail title="Top Sellers">
                    <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
                      {sellers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => navigate({ to: "/profile/$id", params: { id: s.slug } })}
                          className="group flex w-[64px] shrink-0 flex-col items-center gap-2"
                        >
                          <span className="relative h-[62px] w-[62px] shrink-0 rounded-full bg-gradient-to-tr from-[#E5484D] to-[#FF7A7F] p-[1.5px] transition-transform group-active:scale-95">
                            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[2.5px] border-[#0A0A0B] bg-black">
                              {s.avatarUrl ? (
                                <img src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[14px] font-black text-white/40">
                                  {s.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="w-full truncate text-center text-[10.5px] font-medium text-white/50">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Recommended */}
                {recommendedProducts.length > 0 && (
                  <Rail title="Recommended Products">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4">
                      {recommendedProducts.map((p) => (
                        <GridCard key={p.id} product={p} onClick={() => openProduct(p)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {sellers.length > 0 && (
                  <Rail title="Recommended Sellers">
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
                      {sellers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => openShop(s.slug)}
                          className="w-[150px] shrink-0 rounded-2xl bg-[#111113] p-4 text-center"
                        >
                          <span className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-black ring-1 ring-white/10">
                            {s.avatarUrl ? (
                              <img src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[13px] font-black text-white">
                                {s.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="mt-2 block truncate text-[13.5px] font-semibold text-white">{s.name}</span>
                          <span className="block text-[11.5px] text-white/40">{s.productsCount} products</span>
                          <span className="mt-3 block rounded-xl bg-[#E5484D] py-2 text-[11.5px] font-bold text-white">
                            View shop
                          </span>
                        </button>
                      ))}
                    </div>
                  </Rail>
                )}

                {sellers.length > 2 && (
                  <Rail title="Recommended Shops">
                    <div className="space-y-3 px-4">
                      {sellers.slice(2, 6).map((s) => (
                        <ShopCard key={s.id} seller={s} onClick={() => openShop(s.slug)} />
                      ))}
                    </div>
                  </Rail>
                )}

                {/* Category grids — 2-row horizontal scroll per category */}
                {categoryBuckets.map(({ cat, items }) => (
                  <Rail
                    key={cat.id}
                    title={cat.name}
                    onSeeAll={() => {
                      setActiveCategory(cat);
                      scrollTop();
                    }}
                  >
                    <div className="no-scrollbar overflow-x-auto px-4">
                      <div className="grid grid-flow-col grid-rows-2 gap-x-3 gap-y-5">
                        {items.slice(0, 10).map((p) => (
                          <div key={p.id} className="w-[150px]">
                            <GridCard product={p} onClick={() => openProduct(p)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </Rail>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <CategoryDiscoverySheet
        open={showCategories}
        onClose={() => setShowCategories(false)}
        categories={cats}
        counts={discovery?.categoryCounts ?? {}}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          scrollTop();
        }}
      />
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold transition-colors ${
        active ? "bg-[#E5484D] text-white" : "border border-white/10 bg-[#141416] text-white/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CategoryResults({
  category,
  items,
  onBack,
  onOpenProduct,
}: {
  category: CategoryNode;
  items: ProductDTO[];
  onBack: () => void;
  onOpenProduct: (p: ProductDTO) => void;
}) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 px-4">
        <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full">
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold text-white">{category.name}</h1>
          <p className="text-[12.5px] text-white/40">
            {items.length} {items.length === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-5">
        {items.map((p) => (
          <GridCard key={p.id} product={p} onClick={() => onOpenProduct(p)} />
        ))}
      </div>

      {items.length === 0 && (
        <p className="px-4 py-24 text-center text-[13px] text-white/40">
          No live products in this category yet.
        </p>
      )}
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="min-h-full animate-pulse space-y-5 bg-[#0A0A0B] px-4 pt-12">
      <div className="h-10 w-2/3 rounded-2xl bg-white/5" />
      <div className="h-12 w-full rounded-2xl bg-white/5" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-white/5" />
        ))}
      </div>
      <div className="h-[190px] w-full rounded-3xl bg-white/5" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
