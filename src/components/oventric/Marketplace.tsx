import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
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
  ChevronDown,
  SlidersHorizontal,
  Cloud,
  Truck,
  X,
  Search,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { AdSlot } from "@/components/oventric/ads/AdSlot";
import {
  listProducts,
  listMarketplaceCategories,
  type ProductDTO,
  type CategoryNode,
} from "@/lib/marketplace.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { MarketplaceBanner } from "@/components/oventric/MarketplaceBanner";
import { LightningCountdown } from "@/components/oventric/LightningCountdown";
import { useIsAppShell } from "@/hooks/use-launch-context";

type CategoryKey = "themes" | "plugins" | "blocks" | "scripts";

const CATEGORY_META: Record<
  CategoryKey,
  { label: string; emoji: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  themes: { label: "Themes", emoji: "🎨", Icon: Palette },
  plugins: { label: "Plugins", emoji: "🔌", Icon: Plug },
  blocks: { label: "HTML Blocks", emoji: "🧱", Icon: Blocks },
  scripts: { label: "Scripts", emoji: "📜", Icon: Code2 },
};

function categoryIcon(cat: string): React.ComponentType<{ className?: string }> {
  return (
    (CATEGORY_META as Record<string, { Icon: React.ComponentType<{ className?: string }> }>)[cat]
      ?.Icon ?? Package
  );
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
type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

export function Marketplace() {
  const isAppShell = useIsAppShell();
  const { require, baseCurrency } = useOnboarding();
  const navigate = useNavigate();
  const load = useServerFn(listProducts);
  const loadCats = useServerFn(listMarketplaceCategories);

  const [mode, setMode] = useState<Mode | null>("digital");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [catRoots, setCatRoots] = useState<CategoryNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [promotedOnly, setPromotedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");

  const refresh = () => {
    setError(null);
    load()
      .then((rows) => setProducts(rows))
      .catch((e: Error) => setError(e.message || "Failed to load"));
  };
  useEffect(refresh, [load]);

  useEffect(() => {
    loadCats()
      .then((rows) => setCatRoots(rows ?? []))
      .catch(() => {});
  }, [loadCats]);

  const onOpenProduct = (p: ProductDTO) => {
    require(1, () =>
      navigate({ to: "/product/$id", params: { id: p.id }, search: { qty: 1 } }), "buyer");
  };

  // Global catalogue: every shopper sees every active listing. Prices are
  // converted into the viewer's home currency for display and checkout.
  const currencyScoped = products;

  const digital = useMemo(
    () => (currencyScoped ?? []).filter((p) => p.kind !== "physical"),
    [currencyScoped],
  );
  const physical = useMemo(
    () => (currencyScoped ?? []).filter((p) => p.kind === "physical"),
    [currencyScoped],
  );

  const modeItems = mode === "physical" ? physical : mode === "digital" ? digital : [];

  // Category cards for the active mode: DB categories that have products, plus
  // any product category not defined in the DB. AI Platform pinned first.
  const categories = useMemo(() => {
    if (!mode)
      return [] as Array<{
        slug: string;
        name: string;
        count: number;
        cover: string | null;
        subs: CategoryNode[];
      }>;
    const roots = catRoots.filter((c) => c.kind === mode);
    const counts = new Map<string, ProductDTO[]>();
    modeItems.forEach((p) => {
      const key = norm(p.category) || "other";
      const arr = counts.get(key) ?? [];
      arr.push(p);
      counts.set(key, arr);
    });
    const out: Array<{
      slug: string;
      name: string;
      count: number;
      cover: string | null;
      subs: CategoryNode[];
    }> = [];
    const push = (slug: string, name: string, subs: CategoryNode[]) => {
      const items = counts.get(slug) ?? [];
      counts.delete(slug);
      out.push({
        slug,
        name,
        count: items.length,
        cover: items.find((i) => i.coverUrl)?.coverUrl ?? null,
        subs,
      });
    };
    const ai = roots.find((c) => norm(c.slug).startsWith("ai"));
    if (ai) push(norm(ai.slug), ai.name, ai.children);
    roots.forEach((c) => {
      if (ai && c.id === ai.id) return;
      push(norm(c.slug), c.name, c.children);
    });
    (Object.keys(CATEGORY_META) as CategoryKey[]).forEach((k) => {
      if (out.some((o) => o.slug === k)) return;
      if (counts.has(k)) push(k, CATEGORY_META[k].label, []);
    });
    counts.forEach((_items, slug) => push(slug, slug.charAt(0).toUpperCase() + slug.slice(1), []));
    return out.filter((c) => c.count > 0);
  }, [catRoots, mode, modeItems]);

  const activeCatNode = categories.find((c) => c.slug === activeCat) ?? null;

  const searchTerm = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = modeItems;
    if (activeCat) list = list.filter((p) => norm(p.category) === activeCat);
    if (activeSub) list = list.filter((p) => norm(p.subcategory) === activeSub);
    if (searchTerm) {
      list = list.filter((p) => {
        const hay =
          `${p.name} ${p.category} ${p.subcategory ?? ""} ${p.vendor ?? ""}`.toLowerCase();
        return hay.includes(searchTerm);
      });
    }
    const min = Number(minPrice);
    const max = Number(maxPrice);
    list = list.filter((p) => {
      const v = displayPriceForProduct(p, baseCurrency).value;
      if (minPrice && Number.isFinite(min) && v < min) return false;
      if (maxPrice && Number.isFinite(max) && v > max) return false;
      if (minRating && p.rating < minRating) return false;
      if (promotedOnly && !p.promoted) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price-asc") {
      sorted.sort(
        (a, b) =>
          displayPriceForProduct(a, baseCurrency).value -
          displayPriceForProduct(b, baseCurrency).value,
      );
    } else if (sort === "price-desc") {
      sorted.sort(
        (a, b) =>
          displayPriceForProduct(b, baseCurrency).value -
          displayPriceForProduct(a, baseCurrency).value,
      );
    } else if (sort === "rating") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else {
      sorted.sort((a, b) => Number(b.promoted) - Number(a.promoted));
    }
    return sorted;
  }, [
    modeItems,
    activeCat,
    activeSub,
    searchTerm,
    minPrice,
    maxPrice,
    minRating,
    promotedOnly,
    sort,
    baseCurrency,
  ]);

  // Sales proxy: review volume first, then rating, then promotion.
  const salesScore = (p: ProductDTO) => p.reviews * 10 + p.rating;

  /** Hot products = top sellers inside the active mode (switches with mode). */
  const hotItems = useMemo(() => {
    const scoped = activeCat ? modeItems.filter((p) => norm(p.category) === activeCat) : modeItems;
    const base = scoped.length >= 4 ? scoped : modeItems;
    return [...base].sort((a, b) => salesScore(b) - salesScore(a)).slice(0, 12);
  }, [modeItems, activeCat]);

  /** Grid with promoted listings woven in after every few cards. */
  const gridItems = useMemo(() => {
    const regular = filtered.filter((p) => !p.promoted);
    const catScope = activeCat
      ? modeItems.filter((p) => norm(p.category) === activeCat)
      : modeItems;
    const promos =
      filtered.filter((p) => p.promoted).length > 0
        ? filtered.filter((p) => p.promoted)
        : catScope.filter((p) => p.promoted);
    if (promotedOnly || promos.length === 0) return filtered;
    const out: ProductDTO[] = [];
    let pi = 0;
    regular.forEach((p, i) => {
      out.push(p);
      if ((i + 1) % 4 === 0) out.push(promos[pi++ % promos.length]);
    });
    if (out.length === regular.length && promos.length) out.push(promos[0]);
    return out;
  }, [filtered, modeItems, activeCat, promotedOnly]);

  /** Recommended = best sellers + promoted across the whole marketplace. */
  const recommended = useMemo(() => {
    const pool = currencyScoped ?? [];
    const promos = pool.filter((p) => p.promoted).sort((a, b) => salesScore(b) - salesScore(a));
    const sellers = pool.filter((p) => !p.promoted).sort((a, b) => salesScore(b) - salesScore(a));
    const mixed: ProductDTO[] = [];
    for (let i = 0; i < 8; i++) {
      if (sellers[i]) mixed.push(sellers[i]);
      if (promos[i]) mixed.push(promos[i]);
    }
    return mixed.slice(0, 8);
  }, [currencyScoped]);

  const activeFilterCount =
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (minRating ? 1 : 0) +
    (promotedOnly ? 1 : 0) +
    (sort !== "featured" ? 1 : 0);

  const resetFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setMinRating(0);
    setPromotedOnly(false);
    setSort("featured");
  };

  const selectMode = (m: Mode) => {
    setMode((prev) => (prev === m ? null : m));
    setActiveCat(null);
    setActiveSub(null);
  };

  const selectCat = (slug: string) => {
    setActiveCat((prev) => (prev === slug ? null : slug));
    setActiveSub(null);
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 py-10 text-center">
        <div className="bg-white border border-red-200 rounded-2xl p-8 shadow-sm">
          <div className="text-red-600 font-bold mb-1">Couldn't load marketplace</div>
          <div className="text-sm text-slate-500 mb-4">{error}</div>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-emerald-600 text-white font-semibold text-sm rounded-full"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!products) return <MarketplaceSkeleton />;

  return (
    <div className={`marketplace-render-safe ${isAppShell ? "bg-black text-slate-200" : "bg-[#F7F8FA] text-slate-700"} min-h-full`}>
      <MarketplaceBanner />
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
        {/* ── Lightning Deals Section ─────────────────────────── */}
        <div className={`mb-8 p-4 border-b-2 ${isAppShell ? "bg-[#1E1E24] border-emerald-500/30" : "bg-white border-slate-900"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <span className="text-lg sm:text-2xl">⚡</span>
                <h2 className={`text-[13px] sm:text-xl font-black italic tracking-tighter uppercase whitespace-nowrap ${isAppShell ? "text-white" : "text-slate-900"}`}>Lightning Deals</h2>
              </div>
              <LightningCountdown />
            </div>
            <button className={`text-xs font-black hover:underline self-end sm:self-center ${isAppShell ? "text-emerald-400" : "text-slate-900"}`}>View All &gt;</button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
            {hotItems.slice(0, 6).map(p => (
              <div key={p.id} className="shrink-0 w-36 sm:w-44 group cursor-pointer" onClick={() => onOpenProduct(p)}>
                <div className={`aspect-square mb-2 overflow-hidden relative ${isAppShell ? "bg-slate-800" : "bg-slate-100"}`}>
                  <ResponsiveImage src={p.coverUrl ?? ""} alt={p.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase">Only {Math.floor(Math.random() * 10) + 1} left</div>
                </div>
                <div className="text-red-600 font-black text-sm">
                  {displayPriceForProduct(p, baseCurrency).formatted}
                </div>
                <div className="text-[10px] text-slate-400 line-through">
                  {computeDisplayPrice({ price_usd: p.priceUSD * 1.5 }, baseCurrency).formatted}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Marketplace search ─────────────────────────────────── */}
        <div className="mb-4 sm:mb-5">
          <div className="relative max-w-2xl mx-auto group">
            <input
              type="search"
              role="searchbox"
              aria-label="Search marketplace products"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!mode) setMode("digital");
              }}

              placeholder="I'm looking for..."
              className={`w-full h-11 sm:h-12 pl-4 pr-12 rounded-none text-sm sm:text-base border-2 focus:outline-none transition-shadow shadow-sm ${isAppShell ? "bg-[#1E1E24] border-emerald-500/30 text-white placeholder:text-slate-500" : "bg-white border-slate-900 text-slate-900 placeholder:text-slate-400"}`}
            />
            <div className={`absolute right-0 top-0 h-full px-3 sm:px-4 flex items-center justify-center border-l-2 transition-colors pointer-events-none ${isAppShell ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-900 border-slate-900 text-white"}`}>
              <Search className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ── Mode cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <ModeCard
            label="Digital Products"
            sub="Themes, plugins, scripts & AI tools"
            Icon={Cloud}
            count={digital.length}
            covers={
              digital
                .map((p) => p.coverUrl)
                .filter(Boolean)
                .slice(0, 4) as string[]
            }
            active={mode === "digital"}
            onClick={() => selectMode("digital")}
            isAppShell={isAppShell}
          />
          <ModeCard
            label="Physical Products"
            sub="Goods you can see, touch & collect"
            Icon={Truck}
            count={physical.length}
            covers={
              physical
                .map((p) => p.coverUrl)
                .filter(Boolean)
                .slice(0, 4) as string[]
            }
            active={mode === "physical"}
            onClick={() => selectMode("physical")}
            isAppShell={isAppShell}
          />
        </div>

        {/* ── Category slider (drops down under the selected mode) ── */}
        <Collapse open={!!mode && categories.length > 0 && !searchTerm}>
          <div className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-base sm:text-lg font-black uppercase tracking-tight ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
                {mode === "physical" ? "Physical" : "Digital"} categories
              </h2>

              {activeCat && (
                <button
                  onClick={() => {
                    setActiveCat(null);
                    setActiveSub(null);
                  }}
                  className={`text-xs hover:underline font-black uppercase tracking-tighter ${isAppShell ? "text-emerald-400" : "text-slate-900"}`}
                >
                  Clear category

                </button>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto snap-x scrollbar-none pb-2">
              {categories.map((c) => {
                const Icon = categoryIcon(c.slug);
                const active = activeCat === c.slug;
                return (
                  <button
                    key={c.slug}
                    onClick={() => selectCat(c.slug)}
                    className={`snap-start shrink-0 w-[160px] sm:w-[190px] text-left rounded-[10px] overflow-hidden border transition-colors ${
                      active
                        ? (isAppShell ? "border-emerald-500 bg-slate-900 shadow-sm" : "border-slate-900 bg-slate-50 shadow-sm")
                        : (isAppShell ? "border-white/10 bg-[#1E1E24] hover:border-white/20" : "border-slate-100 bg-white hover:border-slate-300 hover:shadow-md")
                    }`}
                  >
                    <div className="relative h-20 sm:h-24 bg-slate-100">

                      {c.cover ? (
                        <ResponsiveImage
                          sizes="200px"
                          src={c.cover}
                          alt={c.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="eager"
                          decoding="async"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                      <Icon className="absolute left-2 bottom-2 w-5 h-5 text-white" />
                      <span className="absolute right-2 top-2 text-[10px] font-black bg-red-600 text-white rounded-none px-1.5 py-0.5 shadow-sm ring-1 ring-white/70">
                        {c.count}
                      </span>
                    </div>
                    <div className="px-3 py-2">
                      <div className={`text-xs font-semibold leading-snug line-clamp-2 ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
                        {c.name}
                      </div>
                      {c.subs.length > 0 && (
                        <div className="text-[11px] font-semibold text-red-600 mt-0.5 inline-flex items-center gap-1">
                          {c.subs.length} subcategories{" "}
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${active ? "rotate-180" : ""}`}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Collapse>

        {/* ── Subcategory drop-down ────────────────────────────────── */}
        <Collapse open={!!activeCatNode && activeCatNode.subs.length > 0}>
          <div className="pt-3 flex gap-2 overflow-x-auto scrollbar-none pb-1">
            <SubPill label="All" active={!activeSub} onClick={() => setActiveSub(null)} isAppShell={isAppShell} />
            {(activeCatNode?.subs ?? []).map((s) => (
              <SubPill
                key={s.id}
                label={s.name}
                active={activeSub === norm(s.slug)}
                onClick={() =>
                  setActiveSub((prev) => (prev === norm(s.slug) ? null : norm(s.slug)))
                }
                isAppShell={isAppShell}
              />
            ))}
          </div>
        </Collapse>

        {/* ── Hot products (top sellers in this section) ───────────── */}
        <Collapse open={!!mode && hotItems.length > 0 && !searchTerm}>
          <div className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-400" />
              <h2 className={`text-base sm:text-lg font-extrabold tracking-tight ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
                Hot {mode === "physical" ? "physical" : "digital"} products
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto snap-x scrollbar-none pb-2">
              {hotItems.map((p) => (
                <MiniProductCard
                  key={`hot-${p.id}`}
                  p={p}
                  currency={baseCurrency}
                  onClick={() => onOpenProduct(p)}
                  isAppShell={isAppShell}
                />
              ))}
            </div>
          </div>
        </Collapse>

        {/* ── Toolbar + grid with side filter ──────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className={`text-sm ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
            {searchTerm ? (
              <>
                <span className={`font-bold ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>{filtered.length}</span> result
                {filtered.length === 1 ? "" : "s"} for “
                <span className="text-emerald-600">{searchTerm}</span>”
              </>
            ) : (
              <>
                <span className={`font-bold ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>{filtered.length}</span> item
                {filtered.length === 1 ? "" : "s"}
                {activeCatNode ? (
                  <>
                    {" "}
                    in <span className="text-emerald-600">{activeCatNode.name}</span>
                  </>
                ) : null}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort products"
              className={`h-9 rounded-none border px-2.5 text-sm focus:outline-none focus:border-emerald-500 ${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="rating">Top rated</option>
            </select>
            <button
              onClick={() => setFiltersOpen(true)}
              className={`lg:hidden inline-flex items-center gap-2 h-9 px-3 rounded-none text-sm shadow-sm border ${isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold bg-emerald-600 text-white rounded-full px-1.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-6 items-start">
          <aside className="hidden lg:block w-64 shrink-0 sticky top-4">
            <FilterPanel
              currency={baseCurrency}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              minRating={minRating}
              setMinRating={setMinRating}
              promotedOnly={promotedOnly}
              setPromotedOnly={setPromotedOnly}
              sort={sort}
              setSort={setSort}
              onReset={resetFilters}
              isAppShell={isAppShell}
            />
          </aside>

          {/* Mobile / tablet: bottom sheet */}
          <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} isAppShell={isAppShell}>
            <FilterPanel
              currency={baseCurrency}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              minRating={minRating}
              setMinRating={setMinRating}
              promotedOnly={promotedOnly}
              setPromotedOnly={setPromotedOnly}
              sort={sort}
              setSort={setSort}
              onReset={resetFilters}
              onClose={() => setFiltersOpen(false)}
              isAppShell={isAppShell}
              flush
            />
          </FilterSheet>

          <div className="flex-1 min-w-0">
            {!mode ? (
              <div className={`border rounded-none p-10 text-center ${isAppShell ? "bg-[#1E1E24] border-white/5" : "bg-white border-slate-200"}`}>
                <PackageOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <div className={`font-semibold mb-1 ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>Pick a section</div>
                <div className="text-sm text-slate-500">
                  Choose Digital or Physical products above to browse.
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className={`border rounded-none p-10 text-center ${isAppShell ? "bg-[#1E1E24] border-white/5" : "bg-white border-slate-200"}`}>
                <PackageOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <div className={`font-semibold mb-1 ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>Nothing matches</div>
                <div className="text-sm text-slate-500">
                  Try clearing the category or price filters.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {gridItems.map((p, i) => (
                  <ProductCard
                    key={`${p.id}-${i}`}
                    p={p}
                    currency={baseCurrency}
                    onClick={() => onOpenProduct(p)}
                    index={i}
                  />
                ))}
              </div>
            )}

            <div className="mt-6">
              <AdSlot placement="marketplace" variant="grid" index={0} />
            </div>
          </div>
        </div>


        {/* ── Recommended: best sellers + promoted ─────────────────── */}
        {recommended.length > 0 && !searchTerm && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-300 fill-current" />
              <h2 className={`text-base sm:text-lg font-extrabold tracking-tight ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
                Recommended for you
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {recommended.map((p, i) => (
                <ProductCard
                  key={`reco-${p.id}`}
                  p={p}
                  currency={baseCurrency}
                  onClick={() => onOpenProduct(p)}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}
        {/* Clears the floating bottom nav + device safe area on mobile. */}
        <div
          className="md:hidden"
          style={{ height: "calc(5rem + max(env(safe-area-inset-bottom), 0.5rem))" }}
          aria-hidden
        />
      </div>
    </div>
  );
}



/** Mobile / tablet filter bottom sheet. Hidden entirely on lg+ (sidebar there). */
function FilterSheet({
  open,
  onClose,
  children,
  isAppShell,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isAppShell: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 w-full bg-slate-900/50"
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain shadow-[0_-8px_30px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom duration-200 ${isAppShell ? "bg-[#121214]" : "bg-white"}`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <div className={`sticky top-0 flex justify-center pt-3 pb-1 ${isAppShell ? "bg-black" : "bg-white"}`}>
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>
        {children}
        <div className="px-4 pb-2">
          <button
            onClick={onClose}
            className={`w-full h-11 font-bold text-sm rounded-none ${isAppShell ? "bg-emerald-600 text-white" : "bg-emerald-600 text-white"}`}
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}


/** Height-animated drop-down wrapper — no filters/blur, GPU-safe. */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}

function ModeCard({
  label,
  sub,
  Icon,
  count,
  covers,
  active,
  onClick,
  isAppShell,
}: {
  label: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  count: number;
  covers: string[];
  active: boolean;
  onClick: () => void;
  isAppShell: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      className={`text-left rounded-[10px] overflow-hidden border transition-colors ${
        active
          ? (isAppShell ? "border-emerald-500 bg-emerald-500/10 shadow-sm" : "border-emerald-500 bg-emerald-50 shadow-sm")
          : (isAppShell ? "border-white/10 bg-[#1E1E24] hover:border-white/20" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md")
      }`}
    >
      <div className={`relative h-28 sm:h-36 grid grid-cols-2 grid-rows-2 gap-px ${isAppShell ? "bg-slate-800" : "bg-slate-100"}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`relative overflow-hidden ${isAppShell ? "bg-slate-900" : "bg-slate-100"}`}>
            {covers[i] ? (
              <img
                src={covers[i]}
                alt=""
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <Icon className="absolute left-3 top-3 w-6 h-6 text-white" />
        <span className="absolute right-3 top-3 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white rounded-none px-2 py-0.5 shadow-sm ring-1 ring-white/70">
          {count} items
        </span>
      </div>
      <div className="px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className={`font-extrabold text-[13px] sm:text-base leading-tight ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
            {label}
          </h2>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${active ? "rotate-180" : ""}`}
          />
        </div>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-snug">{sub}</p>
      </div>
    </button>
  );
}

/** Compact hot-product card — matches the category card footprint. */
function MiniProductCard({
  p,
  currency,
  onClick,
  isAppShell,
}: {
  p: ProductDTO;
  currency: Currency;
  onClick: () => void;
  isAppShell: boolean;
}) {
  const Icon = categoryIcon(p.category);
  const mp = displayPriceForProduct(p, currency);
  const miniPrice = (Number(mp.value) || 0) <= 0 ? "FREE" : mp.formatted;
  return (
    <button
      onClick={onClick}
      className={`snap-start shrink-0 w-[160px] sm:w-[190px] text-left rounded-[10px] overflow-hidden border transition-colors ${
        p.promoted
          ? (isAppShell ? "border-emerald-500 bg-emerald-500/10" : "border-emerald-400 bg-emerald-50/60")
          : (isAppShell ? "border-white/10 bg-[#1E1E24] hover:border-white/20" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md")
      }`}
    >
      <div className={`relative h-20 sm:h-24 ${isAppShell ? "bg-slate-800" : "bg-slate-100"}`}>
        {p.coverUrl ? (
          <ResponsiveImage
            sizes="200px"
            src={p.coverUrl}
            alt={p.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <Icon className="absolute left-2 bottom-2 w-5 h-5 text-white" />
        {p.promoted && (
          <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-emerald-600 text-white rounded-none px-1.5 py-0.5 shadow-sm">
            Promoted
          </span>
        )}
        <span
          className={`absolute right-2 top-2 inline-flex items-center gap-0.5 text-[10px] font-bold bg-white/90 rounded-none px-1.5 py-0.5 shadow-sm ${p.rating > 0 ? "text-amber-600" : "text-slate-400"}`}
        >
          <Star
            className={`w-2.5 h-2.5 ${p.rating > 0 ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-300"}`}
          />
          {(p.rating || 0).toFixed(1)}
        </span>
      </div>
      <div className="px-3 py-2">
        {p.kind === "physical" ? (
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 sm:text-red-600 truncate">
            {p.category}
            {p.subcategory ? ` · ${p.subcategory}` : ""}
          </div>
        ) : (
          <CategoryTicker label={`${p.category}${p.subcategory ? ` · ${p.subcategory}` : ""}`} />
        )}
        <div className={`text-xs font-semibold leading-snug line-clamp-2 ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
          {p.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-red-600 font-extrabold text-xs truncate">{miniPrice}</span>
          <span className="text-[10px] text-slate-500 shrink-0">{p.reviews} sold</span>
        </div>
      </div>
    </button>
  );
}

function SubPill({
  label,
  active,
  onClick,
  isAppShell,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  isAppShell: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-none text-xs font-semibold border transition-colors whitespace-nowrap ${
        active
          ? (isAppShell ? "bg-emerald-600 border-emerald-600 text-white" : "bg-emerald-600 border-emerald-600 text-white")
          : (isAppShell ? "bg-[#1E1E24] border-white/10 text-slate-400 hover:text-slate-200" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300")
      }`}
    >
      {label}
    </button>
  );
}

function FilterPanel({
  currency,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  minRating,
  setMinRating,
  promotedOnly,
  setPromotedOnly,
  sort,
  setSort,
  onReset,
  onClose,
  isAppShell,
  flush = false,
}: {
  currency: Currency;
  minPrice: string;
  setMinPrice: (v: string) => void;
  maxPrice: string;
  setMaxPrice: (v: string) => void;
  minRating: number;
  setMinRating: (v: number) => void;
  promotedOnly: boolean;
  setPromotedOnly: (v: boolean) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
  onReset: () => void;
  onClose?: () => void;
  isAppShell: boolean;
  flush?: boolean;
}) {
  const input =
    `w-full border rounded-none px-2.5 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors ${isAppShell ? "bg-[#121214] border-white/10 text-slate-200 placeholder:text-slate-600" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"}`;
  return (
    <div
      className={
        flush ? (isAppShell ? "bg-black p-4" : "bg-white p-4") : (isAppShell ? "bg-[#1E1E24] border border-white/5 rounded-none p-4" : "bg-white border border-slate-200 rounded-none p-4")
      }
    >

      <div className="flex items-center justify-between mb-4">
        <div className={`inline-flex items-center gap-2 font-bold text-sm ${isAppShell ? "text-slate-200" : "text-slate-900"}`}>
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className={`text-xs font-semibold hover:opacity-80 transition-opacity ${isAppShell ? "text-emerald-400" : "text-emerald-600"}`}
          >
            Reset
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-900">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1.5">
        Price ({currency})
      </label>
      <div className="flex items-center gap-2 mb-4">
        <input
          inputMode="numeric"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="Min"
          className={input}
        />
        <span className="text-slate-400">–</span>
        <input
          inputMode="numeric"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="Max"
          className={input}
        />
      </div>

      <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1.5">
        Sort by
      </label>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        className={`${input} mb-4`}
      >
        <option value="featured">Featured</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="rating">Top rated</option>
      </select>

      <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1.5">
        Minimum rating
      </label>
      <div className="flex gap-2 mb-4">
        {[0, 3, 4, 4.5].map((r) => (
          <button
            key={r}
            onClick={() => setMinRating(r)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              minRating === r
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-slate-50 border-slate-200 text-slate-600"

            }`}
          >
            {r === 0 ? "Any" : `${r}+`}
          </button>
        ))}
      </div>

      <button
        onClick={() => setPromotedOnly(!promotedOnly)}
        className={`w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${
          promotedOnly
            ? "bg-slate-900 border-slate-900 text-white"
            : "bg-slate-50 border-slate-200 text-slate-600"

        }`}
      >
        <Flame className="w-3.5 h-3.5" /> Promoted only
      </button>
    </div>
  );
}

/** Alternates the category label with a cashback nudge (digital assets only). */
function CategoryTicker({ label }: { label: string }) {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAlt((v) => !v), 3200);
    return () => clearInterval(t);
  }, []);
  const base =
    "absolute inset-x-0 top-0 truncate text-[10px] font-black uppercase tracking-wider transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform";
  return (
    <div className="relative h-[13px] overflow-hidden">
      <div
        className={`${base} text-[#E13B2E] ${
          alt ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {label}
      </div>
      <div
        className={`${base} text-red-600 ${
          alt ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      >
        Earn 2% Cashback on this item
      </div>
    </div>
  );
}

function ProductCard({
  p,
  currency,
  onClick,
  index = 0,
}: {
  p: ProductDTO;
  currency: Currency;
  onClick: () => void;
  index?: number;
}) {
  const Icon = categoryIcon(p.category);
  const eager = index < 4;
  const price = displayPriceForProduct(p, currency);
  const isFree = (Number(price.value) || 0) <= 0;
  const catLabel = `${p.category}${p.subcategory ? ` · ${p.subcategory}` : ""}`;
  const cardInner = (
    <div className="bg-white border-2 border-slate-100 rounded-none p-3 shadow-sm hover:shadow-xl transition-all flex flex-col h-full group cursor-pointer" onClick={onClick}>
      <div className="relative aspect-[4/3] rounded-none bg-slate-100 mb-3 overflow-hidden">
        {p.coverUrl ? (
          <ResponsiveImage
            sizes="(min-width: 1280px) 240px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            src={p.coverUrl}
            alt={p.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)",
            }}
          />
        )}
        <Icon className="absolute right-2 bottom-2 w-5 h-5 text-white drop-shadow" />
        <span className="absolute top-2 left-2 bg-[#F39C12] text-white text-[10px] font-black px-2 py-0.5 rounded-none shadow-sm italic uppercase tracking-wider">
          Deal
        </span>
        {p.promoted && (
          <span className="absolute top-8 left-2 text-[9px] font-black uppercase tracking-wider bg-[#E13B2E] text-white rounded-none px-2 py-1 shadow-sm italic">
            Ad
          </span>
        )}
        <span
          className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider rounded-none px-1.5 py-0.5 ${
            p.kind === "physical" ? "bg-sky-600 text-white" : "bg-slate-900/80 text-white"
          }`}
        >
          {p.kind === "physical" ? "Physical" : "Digital"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {p.kind === "physical" ? (
          <div className="text-[10px] font-black uppercase tracking-wider text-[#E13B2E] truncate">
            {catLabel}
          </div>
        ) : (
          <CategoryTicker label={catLabel} />
        )}
        <h3 className="text-slate-900 text-xs sm:text-[13px] font-bold leading-snug line-clamp-2 mt-0.5">
          {p.name}
        </h3>
        <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.vendor}</div>
        
        <div className="flex items-center gap-1 mt-1 text-[11px]">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-2.5 h-2.5 ${
                  s <= Math.round(p.rating || 5)
                    ? "text-slate-900 fill-slate-900"
                    : "text-slate-300 fill-slate-200"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            {p.reviews || Math.floor(Math.random() * 1000) + 1}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 pt-3 mt-2 border-t border-slate-50">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[#E13B2E] font-black text-lg">
            {isFree ? "FREE" : price.formatted}
          </span>
          {!isFree && (
            <span className="text-[11px] text-slate-400 line-through">
              {computeDisplayPrice({ price_usd: p.priceUSD * 1.4 }, currency).formatted}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
             <span className="bg-orange-50 text-orange-600 text-[9px] font-black px-1 rounded-sm">Top Rated</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="p-1.5 border-2 border-slate-900 rounded-full text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return cardInner;

}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-none p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-lg transition-shadow animate-pulse">
      <div className="aspect-[4/3] rounded-none bg-slate-100 mb-3" />
      <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-1/2 bg-slate-100 rounded mb-4" />
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
        <div className="h-4 w-16 bg-slate-100 rounded" />
        <div className="h-6 w-12 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="marketplace-render-safe bg-[#F7F8FA] min-h-full max-w-full">
      <div className="max-w-7xl mx-auto w-full px-4 py-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="h-44 rounded-none bg-slate-100 animate-pulse" />
          <div className="h-44 rounded-none bg-slate-100 animate-pulse" />
        </div>
        <div className="flex gap-3 mb-6 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-[160px] sm:w-[190px] h-36 rounded-none bg-slate-100 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">

          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
