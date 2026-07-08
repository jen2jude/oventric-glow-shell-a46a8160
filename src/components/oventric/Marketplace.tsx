import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Star,
  ShoppingCart,
  Palette,
  Plug,
  Blocks,
  Code2,
  Sparkles,
  Target,
  Flame,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAdminStore, useActiveAds } from "@/lib/admin/store";
import { AdCard } from "@/components/oventric/AdCard";

type CategoryKey = "themes" | "plugins" | "blocks" | "scripts";

interface Product {
  id: string;
  name: string;
  category: CategoryKey;
  priceUSD: number;
  rating: number;
  reviews: number;
  vendor: string;
  hue: string;
  promoted?: boolean;
}

const CATEGORY_META: Record<
  CategoryKey,
  { label: string; emoji: string; title: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  themes: { label: "Themes", emoji: "🎨", title: "🔥 Featured Themes", Icon: Palette },
  plugins: { label: "Plugins", emoji: "🔌", title: "⚙️ Popular Plugins", Icon: Plug },
  blocks: { label: "HTML Blocks", emoji: "🧱", title: "🧱 Trending HTML Blocks", Icon: Blocks },
  scripts: { label: "Scripts", emoji: "📜", title: "📜 Top Scripts", Icon: Code2 },
};

const PRODUCTS: Product[] = [
  { id: "t1", name: "Nebula Admin Theme", category: "themes", priceUSD: 49, rating: 4.9, reviews: 312, vendor: "Kessler Labs", hue: "from-indigo-500 to-purple-600" },
  { id: "t2", name: "Aurora SaaS Kit", category: "themes", priceUSD: 79, rating: 4.8, reviews: 214, vendor: "PixelForge", hue: "from-emerald-500 to-teal-600", promoted: true },
  { id: "t3", name: "Obsidian Portfolio", category: "themes", priceUSD: 29, rating: 4.7, reviews: 98, vendor: "Nightshade", hue: "from-slate-600 to-slate-900" },
  { id: "t4", name: "Solaris Landing", category: "themes", priceUSD: 39, rating: 4.6, reviews: 145, vendor: "Sunlab", hue: "from-orange-500 to-pink-600" },
  { id: "t5", name: "Meridian Blog", category: "themes", priceUSD: 25, rating: 4.5, reviews: 62, vendor: "Inkwell", hue: "from-sky-500 to-cyan-600" },
  { id: "t6", name: "Void Commerce", category: "themes", priceUSD: 89, rating: 4.9, reviews: 401, vendor: "Kessler Labs", hue: "from-fuchsia-600 to-violet-700" },

  { id: "p1", name: "Realtime Chat Widget", category: "plugins", priceUSD: 19, rating: 4.8, reviews: 512, vendor: "SocketLab", hue: "from-emerald-400 to-emerald-700" },
  { id: "p2", name: "Stripe Checkout Plus", category: "plugins", priceUSD: 35, rating: 4.9, reviews: 890, vendor: "Payflow", hue: "from-purple-500 to-indigo-700", promoted: true },
  { id: "p3", name: "SEO Meta Manager", category: "plugins", priceUSD: 12, rating: 4.6, reviews: 233, vendor: "RankRise", hue: "from-lime-500 to-green-700" },
  { id: "p4", name: "Analytics Beacon", category: "plugins", priceUSD: 24, rating: 4.7, reviews: 178, vendor: "MetricLab", hue: "from-rose-500 to-red-700" },
  { id: "p5", name: "Auth Gateway", category: "plugins", priceUSD: 45, rating: 4.9, reviews: 620, vendor: "Vaultly", hue: "from-amber-500 to-orange-700" },
  { id: "p6", name: "Cache Booster", category: "plugins", priceUSD: 18, rating: 4.5, reviews: 92, vendor: "Turbomesh", hue: "from-cyan-500 to-blue-700" },

  { id: "b1", name: "Hero Section Pack (24)", category: "blocks", priceUSD: 15, rating: 4.7, reviews: 145, vendor: "BlockKit", hue: "from-pink-500 to-rose-700" },
  { id: "b2", name: "Pricing Tables Bundle", category: "blocks", priceUSD: 9, rating: 4.6, reviews: 87, vendor: "BlockKit", hue: "from-teal-500 to-cyan-700" },
  { id: "b3", name: "Footer Collection", category: "blocks", priceUSD: 7, rating: 4.4, reviews: 51, vendor: "Baseline", hue: "from-slate-500 to-slate-800" },
  { id: "b4", name: "Testimonial Grids", category: "blocks", priceUSD: 12, rating: 4.8, reviews: 210, vendor: "BlockKit", hue: "from-violet-500 to-fuchsia-700", promoted: true },
  { id: "b5", name: "Feature Callouts", category: "blocks", priceUSD: 10, rating: 4.5, reviews: 74, vendor: "Baseline", hue: "from-emerald-500 to-lime-700" },
  { id: "b6", name: "Marquee & Logos", category: "blocks", priceUSD: 6, rating: 4.3, reviews: 39, vendor: "Baseline", hue: "from-yellow-500 to-orange-700" },

  { id: "s1", name: "Cron Runner Script", category: "scripts", priceUSD: 22, rating: 4.7, reviews: 118, vendor: "Devkit", hue: "from-blue-500 to-indigo-700" },
  { id: "s2", name: "Postgres RLS Starter", category: "scripts", priceUSD: 49, rating: 4.9, reviews: 402, vendor: "Kessler Labs", hue: "from-emerald-500 to-emerald-800", promoted: true },
  { id: "s3", name: "Image Optimizer CLI", category: "scripts", priceUSD: 14, rating: 4.6, reviews: 73, vendor: "PixelForge", hue: "from-pink-500 to-red-700" },
  { id: "s4", name: "Webhook Signer", category: "scripts", priceUSD: 11, rating: 4.5, reviews: 55, vendor: "Vaultly", hue: "from-purple-500 to-fuchsia-700" },
  { id: "s5", name: "Sitemap Generator", category: "scripts", priceUSD: 8, rating: 4.4, reviews: 42, vendor: "RankRise", hue: "from-cyan-500 to-teal-700" },
  { id: "s6", name: "Rate Limit Guard", category: "scripts", priceUSD: 17, rating: 4.7, reviews: 91, vendor: "Turbomesh", hue: "from-amber-500 to-yellow-700" },
];

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };
const FX_FROM_USD: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };

function formatPrice(usd: number, cur: Currency) {
  const val = usd * FX_FROM_USD[cur];
  const rounded = cur === "USD" ? val.toFixed(0) : Math.round(val).toLocaleString();
  return `${CURRENCY_SYMBOL[cur]}${rounded}`;
}

export function Marketplace() {
  const { require, baseCurrency } = useOnboarding();
  const admin = useAdminStore();
  const [activeTab, setActiveTab] = useState<"all" | CategoryKey>("all");
  const [fullCategory, setFullCategory] = useState<CategoryKey | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const handleBuy = () => require(2, () => alert("Proceeding to checkout (mock)"));

  const adminProducts: Product[] = useMemo(
    () =>
      admin.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category as CategoryKey,
        priceUSD: p.priceUSD,
        rating: 5.0,
        reviews: 0,
        vendor: p.vendor,
        hue: "from-emerald-500 to-teal-700",
        promoted: true,
      })),
    [admin.products],
  );
  const ALL_PRODUCTS = useMemo(() => [...adminProducts, ...PRODUCTS], [adminProducts]);
  const marketplaceAds = useActiveAds("marketplace");

  const recommended = useMemo(() => {
    const promoted = ALL_PRODUCTS.filter((p) => p.promoted);
    const rest = ALL_PRODUCTS.filter((p) => !p.promoted).slice(0, 6);
    return [...promoted, ...rest].slice(0, 8);
  }, [ALL_PRODUCTS]);

  const onPillClick = (key: "all" | CategoryKey) => {
    setActiveTab(key);
    if (key === "all") return;
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (fullCategory) {
    const meta = CATEGORY_META[fullCategory];
    const items = ALL_PRODUCTS.filter((p) => p.category === fullCategory);
    return (
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <button
          onClick={() => setFullCategory(null)}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="text-2xl md:text-3xl font-black text-white">
            {meta.emoji} All {meta.label}
          </h1>
          <span className="text-xs text-slate-500">{items.length} items</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={handleBuy} full />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 mt-8 text-sm">
          <button className="px-3 py-1.5 rounded-lg bg-[#1E1E24] border border-white/10 text-slate-400 hover:text-white">‹ Prev</button>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300">1</span>
          <button className="px-3 py-1.5 rounded-lg bg-[#1E1E24] border border-white/10 text-slate-400 hover:text-white">2</button>
          <button className="px-3 py-1.5 rounded-lg bg-[#1E1E24] border border-white/10 text-slate-400 hover:text-white">3</button>
          <button className="px-3 py-1.5 rounded-lg bg-[#1E1E24] border border-white/10 text-slate-400 hover:text-white">Next ›</button>
        </div>
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
      {/* Sticky category pill nav */}
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
          const items = ALL_PRODUCTS.filter((p) => p.category === cat);
          const ad = marketplaceAds.find((a) => a.id.charCodeAt(3) % 4 === Object.keys(CATEGORY_META).indexOf(cat));
          return (
            <section
              key={cat}
              ref={(el) => {
                sectionRefs.current[cat] = el;
              }}
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
                  <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={handleBuy} />
                ))}
                {ad && <AdCard ad={ad} />}
                <ViewMoreCard label={meta.label} onClick={() => setFullCategory(cat)} />
              </div>
            </section>
          );
        })}

        <div className="border-t border-white/5 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-black text-white">🤖 Recommended For You</h2>
            <span className="text-xs text-slate-500 hidden sm:inline">Curated by trending intent</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommended.slice(0, 3).map((p) => (
              <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={handleBuy} full />
            ))}
            <BountyInjectionCard onSolve={() => require(2, () => alert("Applying to bounty (mock)"))} />
            {recommended.slice(3, 7).map((p) => (
              <ProductCard key={p.id} p={p} currency={baseCurrency} onBuy={handleBuy} full />
            ))}
          </div>
        </div>
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
  p: Product;
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
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)"
        }} />
        <Icon className="absolute right-2 bottom-2 w-6 h-6 text-white/70" />
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

function BountyInjectionCard({ onSolve }: { onSolve: () => void }) {
  return (
    <div className="relative bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-4 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] flex flex-col">
      <div className="inline-flex self-start items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wide mb-2">
        <Target className="w-3 h-3" />
        ACTIVE BOUNTY · $320
      </div>
      <h3 className="text-white font-bold text-sm leading-snug mb-1">Design a token-gated Discord onboarding flow</h3>
      <p className="text-xs text-slate-400 mb-3 line-clamp-2 flex-1">
        Wallet-verified role assignment with a 3-step welcome journey.
      </p>
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
        <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> 7 applicants</span>
        <span>Closes 5d</span>
      </div>
      <button
        onClick={onSolve}
        className="w-full px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors"
      >
        Solve &amp; Earn
      </button>
    </div>
  );
}
