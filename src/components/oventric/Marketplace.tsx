import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Cloud,
  Truck,
  Flame,
  Search,
  Zap,
  Star,
  ShoppingBag,
  Heart,
  ArrowRight,
  Filter,
  Globe,
  LayoutGrid,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  listProducts,
  listMarketplaceCategories,
  getMarketplaceDiscovery,
  type ProductDTO,
  type CategoryNode,
} from "@/lib/marketplace.functions";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { MarketplaceBanner } from "@/components/oventric/MarketplaceBanner";
import { LightningCountdown } from "@/components/oventric/LightningCountdown";
import { SectionHeader } from "./marketplace-discovery/SectionHeader";
import { ProductDiscoveryCard } from "./marketplace-discovery/ProductDiscoveryCard";
import { SellerDiscoveryCard } from "./marketplace-discovery/SellerDiscoveryCard";
import { FeaturedHero } from "./marketplace-discovery/FeaturedHero";
import { CategoryDiscoverySheet } from "./marketplace-discovery/CategoryDiscoverySheet";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import marketplace01 from "@/assets/marketplace01.png.asset.json";
import marketplace04 from "@/assets/marketplace04.png.asset.json";

type Mode = "digital" | "physical";

export function Marketplace() {
  const isAppShell = useIsAppShell();
  const { require } = useOnboarding();
  const navigate = useNavigate();
  
  const loadDiscovery = useServerFn(getMarketplaceDiscovery);
  const loadProducts = useServerFn(listProducts);
  const loadCats = useServerFn(listMarketplaceCategories);

  const [discovery, setDiscovery] = useState<any>(null);
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [catRoots, setCatRoots] = useState<CategoryNode[]>([]);
  const [mode, setMode] = useState<Mode>("digital");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCategories, setShowCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);

  useEffect(() => {
    const refresh = async () => {
      setLoading(true);
      try {
        const [discoveryData, productsData, catsData] = await Promise.all([
          loadDiscovery(),
          loadProducts(),
          loadCats(),
        ]);
        setDiscovery(discoveryData);
        setProducts(productsData);
        setCatRoots(catsData ?? []);
      } catch (e) {
        console.error("Failed to load marketplace data", e);
      } finally {
        setLoading(false);
      }
    };
    refresh();
  }, [loadDiscovery, loadProducts, loadCats]);

  const onOpenProduct = (p: ProductDTO) => {
    require(1, () =>
      navigate({ to: "/product/$id", params: { id: p.id }, search: { qty: 1 } }), "buyer");
  };

  if (loading) return <MarketplaceSkeleton />;

  return (
    <div className={`marketplace-discovery bg-[#0A0A0B] min-h-full pb-20 text-white`}>
      <div className="pt-10 px-6 max-w-[1400px] mx-auto w-full space-y-2">
        <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">Marketplace</h1>
        <p className="text-slate-400 font-medium text-lg">Discover people, products and opportunities.</p>
      </div>

      <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-8 space-y-16">
        
        {/* ── Discovery Filters & Mode Selection ─────────────────────────── */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-[#121214] border border-white/5 rounded-2xl p-1 w-fit shadow-2xl">
              <button
                onClick={() => { setMode("digital"); setSelectedCategory(null); }}
                className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  mode === "digital" && !selectedCategory ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-500 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => { setMode("digital"); setSelectedCategory(null); }}
                className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  mode === "digital" ? "bg-[#1A1A1C] text-slate-300" : "text-slate-500 hover:text-white"
                }`}
              >
                Digital
              </button>
              <button
                onClick={() => { setMode("physical"); setSelectedCategory(null); }}
                className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  mode === "physical" ? "bg-[#1A1A1C] text-slate-300" : "text-slate-500 hover:text-white"
                }`}
              >
                Physical
              </button>
              <button
                onClick={() => setShowCategories(true)}
                className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all text-slate-500 hover:text-white`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Categories
              </button>
            </div>
          </div>

          <div className="relative w-full group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Search products, shops, opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121214] border border-white/5 focus:border-red-500/50 rounded-3xl pl-16 pr-6 py-6 text-sm font-medium focus:outline-none transition-all placeholder:text-slate-600 shadow-xl"
            />
            <button className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <Filter className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ── Featured Hero ─────────────────────────────────── */}
        {discovery?.featured?.[0] && (
          <FeaturedHero
            title={discovery.featured[0].name}
            description={discovery.featured[0].description}
            image={discovery.featured[0].coverUrl || ""}
            accentTitle="Featured"
            ctaText="Explore Now"
            onCtaClick={() => onOpenProduct(discovery.featured[0])}
          />
        )}

        {/* ── Lightning Deals ────────────────────────────────── */}
        <div className="bg-[#121214] border border-white/5 rounded-[32px] p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <div className="bg-red-600/10 p-3 rounded-2xl">
                  <Zap className="w-6 h-6 text-red-500 fill-current" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Lightning Deals</h2>
                  <LightningCountdown />
                </div>
             </div>
             <button className="text-xs font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors">
               View All Deals
             </button>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-6 pb-4">
              {discovery?.trending?.slice(0, 6).map((p: ProductDTO) => (
                <div key={p.id} className="w-64 shrink-0">
                   <ProductDiscoveryCard product={p} onClick={() => onOpenProduct(p)} />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="bg-white/5" />
          </ScrollArea>
        </div>

        {/* ── Discovery Sections: Asymmetric Grid ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          
          {/* Left Column: Trending & New (2/3) */}
          <div className="lg:col-span-2 space-y-16">
            
            <section>
              <SectionHeader
                title="What's Moving 🔥"
                onViewAll={() => {}}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {discovery?.featured?.slice(1, 3).map((p: ProductDTO) => (
                  <ProductDiscoveryCard key={p.id} variant="featured" product={p} onClick={() => onOpenProduct(p)} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeader
                title="New on Oventric"
                onViewAll={() => {}}
              />
              <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                {discovery?.newArrivals?.slice(0, 4).map((p: ProductDTO) => (
                  <ProductDiscoveryCard key={p.id} product={p} onClick={() => onOpenProduct(p)} />
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Top Sellers & Sidebar discovery (1/3) */}
          <aside className="space-y-16">
            <section>
              <SectionHeader
                title="Trending Products"
                onViewAll={() => {}}
              />
              <div className="flex flex-col gap-6">
                {discovery?.trending?.slice(0, 5).map((p: ProductDTO) => (
                  <ProductDiscoveryCard key={p.id} variant="compact" product={p} onClick={() => onOpenProduct(p)} />
                ))}
              </div>
            </section>

            {/* Mode Specific Discovery */}
            <section className="bg-red-600/5 border border-red-500/10 rounded-[32px] p-8">
               <h3 className="text-xl font-black italic uppercase text-white mb-6">
                 Expert Picks: {mode === 'digital' ? 'Assets' : 'Goods'}
               </h3>
               <div className="space-y-4">
                 {discovery?.trending?.slice(6, 10).map((p: ProductDTO) => (
                   <ProductDiscoveryCard key={p.id} variant="compact" product={p} onClick={() => onOpenProduct(p)} />
                 ))}
               </div>
               <button className="w-full mt-8 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all">
                 Browse Category
               </button>
            </section>
          </aside>
        </div>

        {/* ── Full Catalog Recommendation Sections ────────────────── */}
        <section className="space-y-16">
          <SectionHeader title="Recommended Products" onViewAll={() => {}} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {products?.slice(0, 10).map(p => (
              <ProductDiscoveryCard key={p.id} product={p} onClick={() => onOpenProduct(p)} />
            ))}
          </div>
        </section>

        <section className="space-y-16">
          <SectionHeader title="Recommended Shops" onViewAll={() => {}} />
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-6">
              {discovery?.topSellers?.map((seller: any) => (
                <SellerDiscoveryCard key={seller.id} seller={seller} onClick={() => navigate({ to: `/shop/$id`, params: { id: seller.slug } })} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="bg-white/5" />
          </ScrollArea>
        </section>

        <section className="pb-20">
          <SectionHeader title="Top Sellers" onViewAll={() => {}} />
          <div className="flex gap-8 overflow-x-auto pb-8 no-scrollbar">
            {discovery?.topSellers?.map((seller: any) => (
              <div key={seller.id} className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-20 h-20 rounded-full border-2 border-red-500 p-1">
                   <div className="w-full h-full rounded-full overflow-hidden grayscale hover:grayscale-0 transition-all">
                      <img src={seller.avatarUrl || ""} className="w-full h-full object-cover" alt="" />
                   </div>
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{seller.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </section>

      </div>

      <CategoryDiscoverySheet 
        open={showCategories}
        onClose={() => setShowCategories(false)}
        categories={catRoots}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setMode(cat.kind);
        }}
      />
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="bg-[#0A0A0B] min-h-screen p-8 animate-pulse space-y-12">
      <div className="max-w-[1400px] mx-auto space-y-12">
        <div className="h-20 bg-white/5 rounded-[32px] w-full" />
        <div className="flex justify-between gap-8">
           <div className="h-14 bg-white/5 rounded-2xl w-64" />
           <div className="h-14 bg-white/5 rounded-2xl w-96" />
        </div>
        <div className="h-[500px] bg-white/5 rounded-[32px] w-full" />
        <div className="grid grid-cols-3 gap-12">
           <div className="col-span-2 space-y-8">
              <div className="h-64 bg-white/5 rounded-2xl w-full" />
              <div className="h-64 bg-white/5 rounded-2xl w-full" />
           </div>
           <div className="h-screen bg-white/5 rounded-2xl w-full" />
        </div>
      </div>
    </div>
  );
}
