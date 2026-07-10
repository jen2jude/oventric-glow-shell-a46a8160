import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Target, Sparkles, ShoppingBag, MessageCircle, Users, Flame, Package, Megaphone, PlayCircle } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getDiscoveryFeed, type DiscoveryAd, type DiscoveryProduct } from "@/lib/discovery.functions";

export function navigateSection(section: "Feed" | "Marketplace" | "Bounties" | "Circles" | "Messages" | "Wallet" | "Academy") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
}

function useMoney() {
  const { baseCurrency } = useOnboarding();
  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  return (usd: number) => `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}

function PeerRowSkeleton() {
  return (
    <li className="flex items-center gap-2.5">
      <div className="w-9 h-9 shrink-0 rounded-full bg-white/[0.06] animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <SkeletonBar className="h-3 w-3/5" />
        <SkeletonBar className="h-2 w-1/4" />
      </div>
      <SkeletonBar className="h-6 w-16 rounded-md" />
    </li>
  );
}

function BountyRowSkeleton() {
  return (
    <li className="rounded-lg border border-white/5 bg-black/25 p-3 space-y-2">
      <SkeletonBar className="h-16 w-full rounded-md" />
      <SkeletonBar className="h-3 w-4/5" />
      <div className="flex items-center justify-between pt-1">
        <SkeletonBar className="h-4 w-16" />
        <SkeletonBar className="h-3 w-10" />
      </div>
    </li>
  );
}

function ListingRowSkeleton() {
  return (
    <li className="flex items-center gap-3">
      <div className="w-11 h-11 shrink-0 rounded-lg bg-white/[0.06] animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <SkeletonBar className="h-3 w-3/4" />
        <SkeletonBar className="h-2 w-1/3" />
      </div>
      <SkeletonBar className="h-4 w-10" />
    </li>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  cta,
  onCta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-4 px-2">
      <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/5 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-xs font-semibold text-slate-200">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed max-w-[220px]">{hint}</p>
      {cta && onCta && (
        <button
          onClick={onCta}
          className="mt-2.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
        >
          {cta} →
        </button>
      )}
    </div>
  );
}

function SponsoredCard({ ad }: { ad: DiscoveryAd }) {
  const hasMedia = !!ad.coverUrl && ad.tier !== "text";
  return (
    <a
      href={ad.ctaUrl || "#"}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="relative block bg-[#1E1E24] border border-fuchsia-500/30 rounded-2xl overflow-hidden rgb-pulse-glow hover:border-fuchsia-400/60 transition-colors"
    >
      {hasMedia && (
        <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-fuchsia-600 to-purple-800">
          <img
            src={ad.coverUrl as string}
            alt={ad.advertiser}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          {ad.tier === "video" && (
            <PlayCircle className="absolute inset-0 m-auto w-10 h-10 text-white/90 drop-shadow" />
          )}
        </div>
      )}
      <div className="p-4 text-center">
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-300 border border-fuchsia-400/40 bg-black/40 rounded px-1.5 py-0.5">
          <Megaphone className="w-3 h-3" /> Sponsored
        </span>
        <div className="mt-2 text-sm font-bold text-white leading-snug line-clamp-2">
          {ad.title}
        </div>
        {ad.body && (
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed line-clamp-2">
            {ad.body}
          </p>
        )}
        <div className="mt-3">
          <span className="inline-flex items-center justify-center px-4 py-1.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold text-xs rounded-lg">
            {ad.ctaLabel}
          </span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 truncate">by {ad.advertiser}</div>
      </div>
    </a>
  );
}

function SponsoredInline({ ad }: { ad: DiscoveryAd }) {
  return (
    <a
      href={ad.ctaUrl || "#"}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-1 border border-fuchsia-500/25 bg-fuchsia-500/[0.04] hover:bg-fuchsia-500/10 transition-colors"
    >
      <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-fuchsia-600 to-purple-800 flex items-center justify-center">
        {ad.coverUrl && ad.tier !== "text" ? (
          <img src={ad.coverUrl} alt={ad.advertiser} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Megaphone className="w-4 h-4 text-white/90" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-white">{ad.title}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300">
            <Megaphone className="w-2.5 h-2.5 mr-0.5" /> Sponsored
          </span>
          <span className="text-[10px] text-slate-500 truncate">{ad.advertiser}</span>
        </div>
      </div>
      <span className="shrink-0 text-[11px] font-bold text-fuchsia-300">{ad.ctaLabel} →</span>
    </a>
  );
}

function ProductRow({ p, priceFmt }: { p: DiscoveryProduct; priceFmt: (usd: number) => string }) {
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      aria-label={`Open ${p.title}`}
      className="flex items-center gap-3 min-w-0 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-white/[0.03] transition-colors"
    >
      <div
        className={`w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br ${p.hue} flex items-center justify-center`}
      >
        {p.coverUrl ? (
          <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <ShoppingBag className="w-4 h-4 text-white/90" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-white">{p.title}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
            {p.category}
          </span>
          <span className="text-[10px] text-slate-500 truncate">{p.vendor || "Trending"}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-black text-white">{priceFmt(p.priceUsd)}</div>
      </div>
    </Link>
  );
}

export function DiscoveryPanel() {
  const price = useMoney();
  const { require } = useOnboarding();
  const queryClient = useQueryClient();
  const fetchFeed = useServerFn(getDiscoveryFeed);

  // Refetch every mount so the panel refreshes when the user leaves and returns.
  const { data, isLoading } = useQuery({
    queryKey: ["discovery-feed"],
    queryFn: () => fetchFeed(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Also invalidate on window focus so tab-switching refreshes results.
  useEffect(() => {
    const onFocus = () => queryClient.invalidateQueries({ queryKey: ["discovery-feed"] });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

  const peers = data?.peers ?? [];
  const bounties = data?.bounties ?? [];
  const products = data?.products ?? [];
  const ads = data?.ads ?? [];

  const primaryAd = ads[0];
  const inlineAds = ads.slice(1, 4); // interleave up to 3 inside product list
  const trailingAd = ads[4];

  // Interleave ads between products every 3 items.
  const trendingItems: Array<
    { kind: "product"; product: DiscoveryProduct } | { kind: "ad"; ad: DiscoveryAd }
  > = [];
  let adIdx = 0;
  products.forEach((p, i) => {
    trendingItems.push({ kind: "product", product: p });
    if ((i + 1) % 3 === 0 && adIdx < inlineAds.length) {
      trendingItems.push({ kind: "ad", ad: inlineAds[adIdx++] });
    }
  });

  const handleChat = (peerName: string) => {
    require(1, () => {
      toast(`Opening chat with ${peerName}…`);
      navigateSection("Messages");
    }, "buyer");
  };

  return (
    <aside className="hidden lg:flex lg:basis-[38%] lg:shrink-0 lg:grow-0 min-w-0 flex-col gap-4 self-start sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto pr-2 scrollbar-none pb-6 [scrollbar-gutter:stable]">
      {/* Widget A: Top Peers */}
      <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4" aria-busy={isLoading}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>👑</span> Top Peers in Your Circle
          </h3>
          <button
            onClick={() => navigateSection("Circles")}
            className="text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            See all
          </button>
        </div>
        {isLoading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <PeerRowSkeleton key={i} />
            ))}
          </ul>
        ) : peers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No peers yet"
            hint="Grow your circle to see top collaborators here."
            cta="Explore Circles"
            onCta={() => navigateSection("Circles")}
          />
        ) : (
          <ul className="space-y-2">
            {peers.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 min-w-0">
                <Link
                  to="/profile/$id"
                  params={{ id: p.slug }}
                  className={`w-9 h-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white font-bold text-xs`}
                  aria-label={`View ${p.name}`}
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    p.initials
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/profile/$id"
                    params={{ id: p.slug }}
                    className="block truncate text-xs font-semibold text-white hover:text-emerald-400"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{p.stars.toFixed(1)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleChat(p.name)}
                  aria-label={`Chat with ${p.name}`}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 text-[11px] font-semibold"
                >
                  <MessageCircle className="w-3 h-3" /> Chat
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Widget B: High-Yield Bounties */}
      <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4" aria-busy={isLoading}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>🔥</span> High-Yield Bounties
          </h3>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_-2px_rgba(16,185,129,0.7)]">
            Live
          </span>
        </div>
        {isLoading ? (
          <ul className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <BountyRowSkeleton key={i} />
            ))}
          </ul>
        ) : bounties.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No live bounties"
            hint="Check back soon — new escrows drop throughout the day."
            cta="View all bounties"
            onCta={() => navigateSection("Bounties")}
          />
        ) : (
          <ul className="space-y-2.5">
            {bounties.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => {
                    toast(`Opening bounty: ${b.title}`);
                    navigateSection("Bounties");
                  }}
                  aria-label={`Open bounty: ${b.title}`}
                  className="w-full text-left rounded-lg border border-white/5 bg-black/25 p-3 hover:border-emerald-500/40 hover:bg-black/40 transition-colors"
                >
                  {b.coverUrl && (
                    <div className="mb-2 h-20 w-full rounded-md overflow-hidden bg-black/40">
                      <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Target className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2 flex-1 min-w-0">
                      {b.title}
                    </h4>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">Escrow locked</div>
                      <div className="text-sm font-black text-emerald-300 truncate">{price(b.amountUsd)}</div>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-emerald-400">Solve →</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Widget C: Primary Sponsored */}
      {isLoading ? (
        <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4 space-y-2" aria-busy>
          <SkeletonBar className="h-24 w-full" />
          <SkeletonBar className="h-3 w-4/5" />
          <SkeletonBar className="h-2 w-3/5" />
          <SkeletonBar className="h-8 w-full mt-1" />
        </section>
      ) : primaryAd ? (
        <SponsoredCard ad={primaryAd} />
      ) : (
        <section className="relative bg-[#1E1E24] border border-white/5 rounded-2xl p-4 text-center rgb-pulse-glow overflow-hidden">
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-300 border border-fuchsia-400/40 bg-black/40 rounded px-1.5 py-0.5">
            <Megaphone className="w-3 h-3" /> Sponsored
          </span>
          <div className="mt-3 mx-auto w-10 h-10 rounded-md bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h4 className="mt-3 text-sm font-bold text-white leading-snug">
            Your brand could live here
          </h4>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Launch an active campaign from the admin console to appear in this slot.
          </p>
        </section>
      )}

      {/* Widget D: Trending Digital Assets */}
      <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4" aria-busy={isLoading}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>🛍️</span> Trending Digital Assets
          </h3>
          <button
            onClick={() => navigateSection("Marketplace")}
            className="text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            Browse
          </button>
        </div>
        {isLoading ? (
          <ul className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListingRowSkeleton key={i} />
            ))}
          </ul>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Marketplace is quiet"
            hint="No trending assets right now. Be the first to publish."
            cta="Open Marketplace"
            onCta={() => navigateSection("Marketplace")}
          />
        ) : (
          <ul className="space-y-2.5">
            {trendingItems.map((it, i) =>
              it.kind === "product" ? (
                <li key={`p-${it.product.id}-${i}`}>
                  <ProductRow p={it.product} priceFmt={price} />
                </li>
              ) : (
                <li key={`ad-${it.ad.id}-${i}`}>
                  <SponsoredInline ad={it.ad} />
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      {/* Trailing sponsored card */}
      {trailingAd && !isLoading && <SponsoredCard ad={trailingAd} />}
    </aside>
  );
}
