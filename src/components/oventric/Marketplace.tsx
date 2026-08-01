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
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { AdSlot } from "@/components/oventric/ads/AdSlot";
import { listProducts, listMarketplaceCategories, type ProductDTO, type CategoryNode } from "@/lib/marketplace.functions";
import { computeDisplayPrice } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";

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
type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

export function Marketplace() {
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
    require(1, () => navigate({ to: "/product/$id", params: { id: p.id }, search: { qty: 1 } }), "buyer");
  };

  // Global catalogue: every shopper sees every active listing. Prices are
  // converted into the viewer's home currency for display and checkout.
  const currencyScoped = products;


  const digital = useMemo(() => (currencyScoped ?? []).filter((p) => p.kind !== "physical"), [currencyScoped]);
  const physical = useMemo(() => (currencyScoped ?? []).filter((p) => p.kind === "physical"), [currencyScoped]);

  const modeItems = mode === "physical" ? physical : mode === "digital" ? digital : [];

  // Category cards for the active mode: DB categories that have products, plus
  // any product category not defined in the DB. AI Platform pinned first.
  const categories = useMemo(() => {
    if (!mode) return [] as Array<{ slug: string; name: string; count: number; cover: string | null; subs: CategoryNode[] }>;
    const roots = catRoots.filter((c) => c.kind === mode);
    const counts = new Map<string, ProductDTO[]>();
    modeItems.forEach((p) => {
      const key = norm(p.category) || "other";
      const arr = counts.get(key) ?? [];
      arr.push(p);
      counts.set(key, arr);
    });
    const out: Array<{ slug: string; name: string; count: number; cover: string | null; subs: CategoryNode[] }> = [];
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

  const filtered = useMemo(() => {
    let list = modeItems;
    if (activeCat) list = list.filter((p) => norm(p.category) === activeCat);
    if (activeSub) list = list.filter((p) => norm(p.subcategory) === activeSub);
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
      sorted.sort((a, b) => displayPriceForProduct(a, baseCurrency).value - displayPriceForProduct(b, baseCurrency).value);
    } else if (sort === "price-desc") {
      sorted.sort((a, b) => displayPriceForProduct(b, baseCurrency).value - displayPriceForProduct(a, baseCurrency).value);
    } else if (sort === "rating") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else {
      sorted.sort((a, b) => Number(b.promoted) - Number(a.promoted));
    }
    return sorted;
  }, [modeItems, activeCat, activeSub, minPrice, maxPrice, minRating, promotedOnly, sort, baseCurrency]);

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
    const catScope = activeCat ? modeItems.filter((p) => norm(p.category) === activeCat) : modeItems;
    const promos = (filtered.filter((p) => p.promoted).length > 0
      ? filtered.filter((p) => p.promoted)
      : catScope.filter((p) => p.promoted));
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
    (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (minRating ? 1 : 0) + (promotedOnly ? 1 : 0) + (sort !== "featured" ? 1 : 0);


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
        <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-8">
          <div className="text-red-300 font-bold mb-1">Couldn't load marketplace</div>
          <div className="text-sm text-slate-400 mb-4">{error}</div>
          <button onClick={refresh} className="px-4 py-2 bg-emerald-500 text-black font-semibold text-sm rounded-lg">Try again</button>
        </div>
      </div>
    );
  }

  if (!products) return <MarketplaceSkeleton />;

  return (
    <div className="max-w-7xl mx-auto w-full marketplace-render-safe px-4 py-5">
      {/* ── Mode cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <ModeCard
          label="Digital Products"
          sub="Themes, plugins, scripts & AI tools"
          Icon={Cloud}
          count={digital.length}
          covers={digital.map((p) => p.coverUrl).filter(Boolean).slice(0, 4) as string[]}
          active={mode === "digital"}
          onClick={() => selectMode("digital")}
        />
        <ModeCard
          label="Physical Products"
          sub="Goods you can see, touch & collect"
          Icon={Truck}
          count={physical.length}
          covers={physical.map((p) => p.coverUrl).filter(Boolean).slice(0, 4) as string[]}
          active={mode === "physical"}
          onClick={() => selectMode("physical")}
        />
      </div>

      {/* ── Category slider (drops down under the selected mode) ── */}
      <Collapse open={!!mode && categories.length > 0}>
        <div className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
              {mode === "physical" ? "Physical" : "Digital"} categories
            </h2>
            {activeCat && (
              <button onClick={() => { setActiveCat(null); setActiveSub(null); }} className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
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
                  className={`snap-start shrink-0 w-[160px] sm:w-[190px] text-left rounded-xl overflow-hidden border transition-colors ${
                    active ? "border-emerald-500/70 bg-emerald-500/10" : "border-white/10 bg-[#1E1E24] hover:border-white/25"
                  }`}
                >
                  <div className="relative h-20 sm:h-24 bg-white/5">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <Icon className="absolute left-2 bottom-2 w-5 h-5 text-white" />
                    <span className="absolute right-2 top-2 text-[10px] font-bold bg-black/60 text-slate-200 rounded px-1.5 py-0.5">
                      {c.count}
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-white text-sm font-bold leading-snug line-clamp-2">{c.name}</div>
                    {c.subs.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-0.5 inline-flex items-center gap-1">
                        {c.subs.length} subcategories <ChevronDown className={`w-3 h-3 transition-transform ${active ? "rotate-180" : ""}`} />
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
          <SubPill label="All" active={!activeSub} onClick={() => setActiveSub(null)} />
          {(activeCatNode?.subs ?? []).map((s) => (
            <SubPill
              key={s.id}
              label={s.name}
              active={activeSub === norm(s.slug)}
              onClick={() => setActiveSub((prev) => (prev === norm(s.slug) ? null : norm(s.slug)))}
            />
          ))}
        </div>
      </Collapse>

      {/* ── Hot products (top sellers in this section) ───────────── */}
      <Collapse open={!!mode && hotItems.length > 0}>
        <div className="pt-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
              Hot {mode === "physical" ? "physical" : "digital"} products
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x scrollbar-none pb-2">
            {hotItems.map((p) => (
              <MiniProductCard key={`hot-${p.id}`} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} />
            ))}
          </div>
        </div>
      </Collapse>



      {/* ── Toolbar + grid with side filter ──────────────────────── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          <span className="text-white font-bold">{filtered.length}</span> item{filtered.length === 1 ? "" : "s"}
          {activeCatNode ? <> in <span className="text-emerald-400">{activeCatNode.name}</span></> : null}
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="lg:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E1E24] border border-white/10 text-sm text-slate-200"
        >
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-bold bg-emerald-500 text-black rounded-full px-1.5">{activeFilterCount}</span>
          )}
        </button>
      </div>

      <div className="mt-4 flex gap-6 items-start">
        <aside className="hidden lg:block w-64 shrink-0 sticky top-4">
          <FilterPanel
            currency={baseCurrency}
            minPrice={minPrice} setMinPrice={setMinPrice}
            maxPrice={maxPrice} setMaxPrice={setMaxPrice}
            minRating={minRating} setMinRating={setMinRating}
            promotedOnly={promotedOnly} setPromotedOnly={setPromotedOnly}
            sort={sort} setSort={setSort}
            onReset={resetFilters}
          />
        </aside>

        <div className="flex-1 min-w-0">
          <Collapse open={filtersOpen}>
            <div className="lg:hidden mb-4">
              <FilterPanel
                currency={baseCurrency}
                minPrice={minPrice} setMinPrice={setMinPrice}
                maxPrice={maxPrice} setMaxPrice={setMaxPrice}
                minRating={minRating} setMinRating={setMinRating}
                promotedOnly={promotedOnly} setPromotedOnly={setPromotedOnly}
                sort={sort} setSort={setSort}
                onReset={resetFilters}
                onClose={() => setFiltersOpen(false)}
              />
            </div>
          </Collapse>

          {!mode ? (
            <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-10 text-center">
              <PackageOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <div className="text-white font-semibold mb-1">Pick a section</div>
              <div className="text-sm text-slate-400">Choose Digital or Physical products above to browse.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-10 text-center">
              <PackageOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <div className="text-white font-semibold mb-1">Nothing matches</div>
              <div className="text-sm text-slate-400">Try clearing the category or price filters.</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {gridItems.map((p, i) => (
                <ProductCard key={`${p.id}-${i}`} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} index={i} />
              ))}
            </div>
          )}

          <div className="mt-6">
            <AdSlot placement="marketplace" variant="grid" index={0} />
          </div>
        </div>
      </div>

      {/* ── Recommended: best sellers + promoted ─────────────────── */}
      {recommended.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-300 fill-current" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Recommended for you</h2>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {recommended.map((p, i) => (
              <ProductCard key={`reco-${p.id}`} p={p} currency={baseCurrency} onClick={() => onOpenProduct(p)} index={i} />
            ))}
          </div>
        </section>
      )}
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
  label, sub, Icon, count, covers, active, onClick,
}: {
  label: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  count: number;
  covers: string[];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      className={`text-left rounded-2xl overflow-hidden border transition-colors ${
        active ? "border-emerald-500/70 bg-emerald-500/10" : "border-white/10 bg-[#1E1E24] hover:border-white/25"
      }`}
    >
      <div className="relative h-28 sm:h-36 grid grid-cols-2 grid-rows-2 gap-px bg-white/5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden bg-white/5">
            {covers[i] ? (
              <img src={covers[i]} alt="" loading="eager" fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
            ) : null}
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <Icon className="absolute left-3 top-3 w-6 h-6 text-white" />
        <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-wider bg-black/60 text-slate-200 rounded px-2 py-0.5">
          {count} items
        </span>
      </div>
      <div className="px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-white font-black text-sm sm:text-lg leading-tight">{label}</h2>
          <ChevronDown className={`w-4 h-4 shrink-0 text-slate-300 transition-transform ${active ? "rotate-180" : ""}`} />
        </div>
        <p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-snug">{sub}</p>
      </div>
    </button>
  );
}

/** Compact hot-product card — matches the category card footprint. */
function MiniProductCard({
  p, currency, onClick,
}: {
  p: ProductDTO;
  currency: Currency;
  onClick: () => void;
}) {
  const Icon = categoryIcon(p.category);
  return (
    <button
      onClick={onClick}
      className={`snap-start shrink-0 w-[160px] sm:w-[190px] text-left rounded-xl overflow-hidden border transition-colors ${
        p.promoted ? "border-emerald-500/60 bg-emerald-500/5" : "border-white/10 bg-[#1E1E24] hover:border-white/25"
      }`}
    >
      <div className="relative h-20 sm:h-24 bg-white/5">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <Icon className="absolute left-2 bottom-2 w-5 h-5 text-white" />
        {p.promoted && (
          <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-1.5 py-0.5">
            Promoted
          </span>
        )}
        <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 text-[10px] font-bold bg-black/60 text-amber-300 rounded px-1.5 py-0.5">
          <Star className="w-2.5 h-2.5 fill-current" />
          {p.rating.toFixed(1)}
        </span>
      </div>
      <div className="px-3 py-2">
        <div className="text-white text-sm font-bold leading-snug line-clamp-2">{p.name}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-white font-black text-xs truncate">{displayPriceForProduct(p, currency).formatted}</span>
          <span className="text-[10px] text-slate-500 shrink-0">{p.reviews} sold</span>
        </div>
      </div>
    </button>
  );
}

function SubPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {

  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
        active
          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
          : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/25"
      }`}
    >
      {label}
    </button>
  );
}

function FilterPanel({
  currency, minPrice, setMinPrice, maxPrice, setMaxPrice, minRating, setMinRating,
  promotedOnly, setPromotedOnly, sort, setSort, onReset, onClose,
}: {
  currency: Currency;
  minPrice: string; setMinPrice: (v: string) => void;
  maxPrice: string; setMaxPrice: (v: string) => void;
  minRating: number; setMinRating: (v: number) => void;
  promotedOnly: boolean; setPromotedOnly: (v: boolean) => void;
  sort: SortKey; setSort: (v: SortKey) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  const input = "w-full bg-[#121214] border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50";
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 text-white font-bold text-sm">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">Reset</button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Price ({currency})</label>
      <div className="flex items-center gap-2 mb-4">
        <input inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Min" className={input} />
        <span className="text-slate-600">–</span>
        <input inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Max" className={input} />
      </div>

      <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Sort by</label>
      <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${input} mb-4`}>
        <option value="featured">Featured</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="rating">Top rated</option>
      </select>

      <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Minimum rating</label>
      <div className="flex gap-2 mb-4">
        {[0, 3, 4, 4.5].map((r) => (
          <button
            key={r}
            onClick={() => setMinRating(r)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              minRating === r ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"
            }`}
          >
            {r === 0 ? "Any" : `${r}+`}
          </button>
        ))}
      </div>

      <button
        onClick={() => setPromotedOnly(!promotedOnly)}
        className={`w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${
          promotedOnly ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"
        }`}
      >
        <Flame className="w-3.5 h-3.5" /> Promoted only
      </button>
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
  const cardInner = (
    <div className="bg-[#1E1E24] border border-white/5 rounded-2xl p-3 flex flex-col h-full">
      <div className="relative aspect-[4/3] rounded-xl bg-white/5 mb-3 overflow-hidden">
        {p.coverUrl ? (
          <ResponsiveImage
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 40vw, 50vw"
            src={p.coverUrl}
            alt={p.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)"
          }} />
        )}
        <Icon className="absolute right-2 bottom-2 w-5 h-5 text-white/70" />
        {p.promoted && (
          <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-1.5 py-0.5">
            <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" />
            Promoted
          </span>
        )}
        <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-black/60 rounded px-1.5 py-0.5 border ${
          p.kind === "physical" ? "text-sky-300 border-sky-400/50" : "text-emerald-300 border-emerald-400/50"
        }`}>
          {p.kind === "physical" ? "Physical" : "Digital"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white text-sm sm:text-base font-bold leading-snug line-clamp-2">{p.name}</h3>
        <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.vendor}</div>
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
      <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-white/5">
        <div className="text-white font-black text-sm sm:text-base truncate">{displayPriceForProduct(p, currency).formatted}</div>
        <button
          onClick={onClick}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" /> {p.kind === "physical" ? "View" : "Buy"}
        </button>
      </div>
    </div>
  );

  if (p.promoted) {
    return <div className="rounded-2xl rgb-promo-border">{cardInner}</div>;
  }
  return cardInner;
}

function SkeletonCard() {
  return (
    <div className="bg-[#1E1E24] border border-white/5 rounded-2xl p-3 animate-pulse">
      <div className="aspect-[4/3] rounded-xl bg-white/5 mb-3" />
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
    <div className="max-w-7xl mx-auto w-full px-4 py-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="h-44 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-44 rounded-2xl bg-white/5 animate-pulse" />
      </div>
      <div className="flex gap-3 mb-6 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[160px] sm:w-[190px] h-36 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
