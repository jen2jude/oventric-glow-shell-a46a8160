import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star, Target, Sparkles, ShoppingBag, UserPlus, MessageCircle, Users, Flame, Package } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

type Peer = { id: string; name: string; initials: string; stars: number; gradient: string; inCircle: boolean };

const INITIAL_PEERS: Peer[] = [
  { id: "aria-kessler", name: "Aria Kessler", initials: "AK", stars: 4.9, gradient: "from-purple-500 to-pink-500", inCircle: false },
  { id: "marco-tenreiro", name: "Marco Tenreiro", initials: "MT", stars: 4.7, gradient: "from-orange-400 to-red-500", inCircle: true },
  { id: "lena-osei", name: "Lena Osei", initials: "LO", stars: 4.8, gradient: "from-emerald-400 to-teal-500", inCircle: false },
  { id: "davin-park", name: "Davin Park", initials: "DP", stars: 4.6, gradient: "from-sky-400 to-indigo-500", inCircle: false },
];

export function navigateSection(section: "Feed" | "Marketplace" | "Bounties" | "Circles" | "Messages" | "Wallet" | "Academy") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section } }));
}

const bounties = [
  { id: "b1", title: "Build a pgvector migration tool", amountUsd: 900, escrow: true },
  { id: "b2", title: "Realtime notification fan-out on Workers", amountUsd: 1200, escrow: true },
  { id: "b3", title: "Convert Prisma schema to Drizzle + RLS", amountUsd: 450, escrow: true },
];

const listings = [
  { id: "l1", title: "Postgres RLS Starter Kit", category: "Scripts", priceUsd: 49, hue: "from-emerald-500 to-teal-600" },
  { id: "l2", title: "Supabase Audit Log Middleware", category: "Plugins", priceUsd: 29, hue: "from-purple-500 to-pink-600" },
  { id: "l3", title: "Multi-tenant Schema Blueprint", category: "HTML Blocks", priceUsd: 79, hue: "from-sky-500 to-indigo-600" },
];

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
      <SkeletonBar className="h-3 w-4/5" />
      <SkeletonBar className="h-3 w-3/5" />
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

export function DiscoveryPanel() {
  const price = useMoney();
  const { require } = useOnboarding();
  const [peers, setPeers] = useState<Peer[]>(INITIAL_PEERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const handleAddToCircle = (peer: Peer) => {
    require(
      1,
      () => {
        setPeers((prev) => prev.map((p) => (p.id === peer.id ? { ...p, inCircle: true } : p)));
        toast.success(`Circle request sent to ${peer.name}`, {
          description: "You'll be able to chat once they accept.",
        });
      },
      "buyer",
    );
  };

  const handleChat = (peer: Peer) => {
    require(
      1,
      () => {
        toast(`Opening chat with ${peer.name}…`);
        navigateSection("Messages");
      },
      "buyer",
    );
  };

  const handleSolve = (bountyTitle: string) => {
    require(
      2,
      () => {
        toast.success("Bounty opened", { description: bountyTitle });
        navigateSection("Bounties");
      },
      "solver",
    );
  };

  const hasPeers = peers.length > 0;
  const hasBounties = bounties.length > 0;
  const hasListings = listings.length > 0;

  return (
    <aside className="hidden lg:flex lg:basis-[38%] lg:shrink-0 lg:grow-0 min-w-0 flex-col gap-4 self-start sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto pr-2 scrollbar-none pb-6 [scrollbar-gutter:stable] contain-layout">
      {/* Widget A: Top Peers */}
      <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4" aria-busy={loading}>
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
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <PeerRowSkeleton key={i} />
            ))}
          </ul>
        ) : !hasPeers ? (
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
                  params={{ id: p.id }}
                  className={`w-9 h-9 shrink-0 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white font-bold text-xs`}
                >
                  {p.initials}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/profile/$id"
                    params={{ id: p.id }}
                    className="block truncate text-xs font-semibold text-white hover:text-emerald-400"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{p.stars.toFixed(1)}</span>
                  </div>
                </div>
                {p.inCircle ? (
                  <button
                    onClick={() => handleChat(p)}
                    aria-label={`Chat with ${p.name}`}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 text-[11px] font-semibold"
                  >
                    <MessageCircle className="w-3 h-3" /> Chat
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddToCircle(p)}
                    aria-label={`Add ${p.name} to your circle`}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold"
                  >
                    <UserPlus className="w-3 h-3" /> Circle
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>


      {/* Widget B: Hot Bounties */}
      <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4" aria-busy={loading}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>🔥</span> High-Yield Bounties
          </h3>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_-2px_rgba(16,185,129,0.7)]">
            Live
          </span>
        </div>
        {loading ? (
          <ul className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <BountyRowSkeleton key={i} />
            ))}
          </ul>
        ) : !hasBounties ? (
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
              <li key={b.id} className="rounded-lg border border-white/5 bg-black/25 p-3">
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
                  <button
                    onClick={() => handleSolve(b.title)}
                    aria-label={`Solve bounty: ${b.title}`}
                    className="shrink-0 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    Solve →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Widget C: Sponsored */}
      {loading ? (
        <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4 space-y-2" aria-busy>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white/[0.06] animate-pulse" />
            <SkeletonBar className="h-3 w-24" />
          </div>
          <SkeletonBar className="h-3 w-4/5" />
          <SkeletonBar className="h-2 w-full" />
          <SkeletonBar className="h-2 w-3/5" />
          <SkeletonBar className="h-8 w-full mt-1" />
        </section>
      ) : (
        <section className="relative bg-[#1E1E24] border border-white/5 rounded-2xl p-4 rgb-pulse-glow overflow-hidden">
          <span className="absolute top-2 right-3 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
            Sponsored
          </span>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Nebula Cloud</span>
          </div>
          <h4 className="text-sm font-bold text-white leading-snug">
            Deploy edge-native infra in 30 seconds
          </h4>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Sub-50ms cold starts across 40 regions. 10M free requests/mo for indie builders.
          </p>
          <button
            onClick={() => {
              toast.success("Nebula Cloud free tier claimed", { description: "Check your inbox for onboarding steps." });
            }}
            className="mt-3 w-full px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg"
          >
            Claim Free Tier
          </button>
        </section>
      )}

      {/* Widget D: Trending Marketplace */}
      <section className="bg-[#1E1E24] border border-white/5 rounded-2xl p-4" aria-busy={loading}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>🛍️</span> Top Marketplace Files
          </h3>
          <button
            onClick={() => navigateSection("Marketplace")}
            className="text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            Browse
          </button>
        </div>
        {loading ? (
          <ul className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListingRowSkeleton key={i} />
            ))}
          </ul>
        ) : !hasListings ? (
          <EmptyState
            icon={Package}
            title="Marketplace is quiet"
            hint="No trending listings right now. Be the first to publish."
            cta="Open Marketplace"
            onCta={() => navigateSection("Marketplace")}
          />
        ) : (
          <ul className="space-y-2.5">
            {listings.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => {
                    toast(`Opening ${l.title}`);
                    navigateSection("Marketplace");
                  }}
                  aria-label={`Open marketplace listing: ${l.title}`}
                  className="w-full flex items-center gap-3 min-w-0 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-white/[0.03] transition-colors"
                >
                <div
                  className={`w-11 h-11 shrink-0 rounded-lg bg-gradient-to-br ${l.hue} flex items-center justify-center`}
                >
                  <ShoppingBag className="w-4 h-4 text-white/90" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">{l.title}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
                      {l.category}
                    </span>
                    <span className="text-[10px] text-slate-500">Trending</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-black text-white">{price(l.priceUsd)}</div>
                </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
