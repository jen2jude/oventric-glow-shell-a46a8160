import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { 
  LayoutGrid, 
  Settings, 
  Save, 
  Loader2, 
  TrendingUp, 
  ShoppingBag, 
  Star,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { updatePromotionalPlacement, listAllProducts } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/marketplace-controls")({
  head: () => ({
    meta: [{ title: "Marketplace Controls · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MarketplaceControlsPage,
});

function MarketplaceControlsPage() {
  const updatePromoFn = useServerFn(updatePromotionalPlacement);
  const listProductsFn = useServerFn(listAllProducts);
  
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [trendingIds, setTrendingIds] = useState<string[]>([]);

  useEffect(() => {
    listProductsFn().then(setProducts).catch(console.error);
  }, [listProductsFn]);

  const handleSave = async (section: string, ids: string[]) => {
    setBusy(true);
    try {
      await updatePromoFn({ data: { section, data: { productIds: ids } } });
      toast.success(`${section} placement updated`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleId = (ids: string[], setIds: (v: string[]) => void, id: string) => {
    if (ids.includes(id)) {
      setIds(ids.filter(i => i !== id));
    } else {
      setIds([...ids, id]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-white text-2xl font-black">Marketplace Curation</h1>
        <p className="text-sm text-slate-400">Manually override trending and featured placements.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Featured Products Section */}
        <div className="bg-[#141418] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              <h2 className="text-white font-bold text-lg">Featured Products</h2>
            </div>
            <button
              onClick={() => handleSave("featured_products", featuredIds)}
              disabled={busy}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {products.filter(p => p.status === 'active').map(p => (
              <label 
                key={p.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  featuredIds.includes(p.id) 
                    ? "bg-emerald-500/10 border-emerald-500/40" 
                    : "bg-black/20 border-white/5 hover:border-white/10"
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={featuredIds.includes(p.id)} 
                  onChange={() => toggleId(featuredIds, setFeaturedIds, p.id)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{p.vendor} · ${p.price_usd}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Trending Section */}
        <div className="bg-[#141418] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-fuchsia-400" />
              <h2 className="text-white font-bold text-lg">Trending Now</h2>
            </div>
            <button
              onClick={() => handleSave("trending", trendingIds)}
              disabled={busy}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {products.filter(p => p.status === 'active').map(p => (
              <label 
                key={p.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  trendingIds.includes(p.id) 
                    ? "bg-fuchsia-500/10 border-fuchsia-500/40" 
                    : "bg-black/20 border-white/5 hover:border-white/10"
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={trendingIds.includes(p.id)} 
                  onChange={() => toggleId(trendingIds, setTrendingIds, p.id)}
                  className="w-4 h-4 accent-fuchsia-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{p.vendor} · ${p.price_usd}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
