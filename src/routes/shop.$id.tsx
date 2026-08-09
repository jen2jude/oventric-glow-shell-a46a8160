import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BadgeCheck, MessageCircle, ShoppingBag, Star } from "lucide-react";
import {
  getLiveProfileTab,
  getProfileByIdOrSlug,
  getProfileSocialCounts,
  type RealProfileView,
} from "@/lib/profiles.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { FollowButton } from "@/components/oventric/FollowButton";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const ACCENT = "#E5484D";
type ShopTab = "shop" | "collections" | "services" | "about";

export const Route = createFileRoute("/shop/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Shop · @${params.id} · Oventric` },
      {
        name: "description",
        content: `Browse products, collections and services from @${params.id} on Oventric.`,
      },
      { property: "og:title", content: `Shop · @${params.id} · Oventric` },
      {
        property: "og:description",
        content: `Browse products, collections and services from @${params.id} on Oventric.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function Cover({ url, className }: { url?: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden bg-[#1C1C21] ${className ?? ""}`}>
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <ShoppingBag className="h-6 w-6 text-white/25" />
        </div>
      )}
    </div>
  );
}

function ShopPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { baseCurrency } = useOnboarding();

  const loadProfile = useServerFn(getProfileByIdOrSlug);
  const loadCounts = useServerFn(getProfileSocialCounts);
  const loadTab = useServerFn(getLiveProfileTab);

  const [profile, setProfile] = useState<RealProfileView | null>(null);
  const [followers, setFollowers] = useState(0);
  const [products, setProducts] = useState<ProfileListing[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [services, setServices] = useState<ProfileListing[]>([]);
  const [tab, setTab] = useState<ShopTab>("shop");
  const [dmOpen, setDmOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = useCallback(
    (usd: number) => `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [sym, fx],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, c, mp, sv] = await Promise.all([
          loadProfile({ data: { idOrSlug: id } }),
          loadCounts({ data: { idOrSlug: id } }).catch(() => null),
          loadTab({
            data: { idOrSlug: id, tab: "marketplace", page: 1, pageSize: 24, q: "", sort: "newest" },
          }).catch(() => null),
          loadTab({
            data: { idOrSlug: id, tab: "services", page: 1, pageSize: 24, q: "", sort: "newest" },
          }).catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(p.profile);
        setFollowers(c?.followers ?? 0);
        setProducts((mp?.items ?? []) as ProfileListing[]);
        setProductTotal(mp?.total ?? (mp?.items?.length ?? 0));
        setServices((sv?.items ?? []) as ProfileListing[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadProfile, loadCounts, loadTab]);

  const sales = useMemo(() => products.reduce((s, p) => s + (p.sales ?? 0), 0), [products]);
  const rating = useMemo(() => {
    const rated = products.filter((p) => (p.rating ?? 0) > 0);
    return rated.length
      ? (rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length).toFixed(1)
      : "—";
  }, [products]);

  const featured = products[0];
  const arrivals = products.slice(featured ? 1 : 0);
  const name = profile?.displayName ?? id;
  const verified = (profile?.verificationTier ?? "none") !== "none";

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-[#0A0A0B]/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/profile/$id", params: { id }, search: { tab: "marketplace", pages: 1, y: 0, q: "", sort: "newest" } as never })}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-bold">Seller Shop Overview</div>
      </div>

      <div className="mx-auto w-full max-w-[720px] pb-20">
        {/* Cover */}
        <div className="relative h-40 w-full overflow-hidden sm:h-56">
          {profile?.coverUrl ? (
            <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(120deg,#2A1030_0%,#3B1240_55%,#120913_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/30 to-transparent" />
        </div>

        {/* Identity */}
        <div className="-mt-12 px-5">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-[#141417]">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-black text-white/60">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            <h1 className="truncate text-xl font-black">{name}</h1>
            {verified && <BadgeCheck className="h-5 w-5 shrink-0 text-sky-400" />}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {profile?.bio?.trim() || "Digital goods and services on Oventric."}
          </p>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-[#141417] px-3 py-3 text-center">
            {[
              { v: compact(followers), l: "Followers" },
              { v: compact(productTotal), l: "Products" },
              { v: compact(sales), l: "Sales" },
              { v: rating, l: "Rating" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-sm font-black">{s.v}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {profile?.userId ? (
              <FollowButton
                targetId={profile.userId}
                className="h-11 w-full rounded-xl text-sm font-bold"
              />
            ) : (
              <div className="h-11 rounded-xl bg-white/5" />
            )}
            <button
              type="button"
              onClick={() => setDmOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-bold hover:bg-white/[0.08]"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          </div>

          {/* Tabs */}
          <nav className="mt-5 flex items-center gap-1 overflow-x-auto border-b border-white/10">
            {(
              [
                ["shop", "Shop"],
                ["collections", "Collections"],
                ["services", "Services"],
                ["about", "About"],
              ] as [ShopTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  tab === key
                    ? "border-[#E5484D] text-white"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          {loading ? (
            <div className="mt-6 space-y-3">
              <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
            </div>
          ) : tab === "about" ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-4 text-sm leading-relaxed text-slate-300">
              {profile?.bio?.trim() || "This seller hasn't added a shop description yet."}
              {profile?.country && (
                <div className="mt-3 text-xs text-slate-500">Based in {profile.country}</div>
              )}
            </div>
          ) : tab === "services" ? (
            <Grid items={services} price={price} emptyLabel="No services listed yet." />
          ) : tab === "collections" ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-6 text-center text-sm text-slate-400">
              Collections are coming to this shop soon.
            </div>
          ) : (
            <>
              {featured && (
                <>
                  <h2 className="mt-6 text-base font-black">Featured Product</h2>
                  <Link
                    to="/product/$id"
                    params={{ id: featured.id }}
                    className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141417] p-3 hover:bg-[#1A1A1F]"
                  >
                    <Cover url={featured.coverUrl} className="h-20 w-20 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{featured.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                        {featured.blurb?.trim() || featured.category}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-sm font-black">{price(featured.priceUsd)}</span>
                        {(featured.rating ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-amber-400" strokeWidth={0} />
                            {(featured.rating ?? 0).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </>
              )}

              <div className="mt-7 flex items-center justify-between">
                <h2 className="text-base font-black">New Arrivals</h2>
                <span className="text-sm font-bold" style={{ color: ACCENT }}>
                  {compact(productTotal)} items
                </span>
              </div>
              <Grid items={arrivals} price={price} emptyLabel="No products listed yet." />
            </>
          )}
        </div>
      </div>

      {profile?.userId && (
        <ProfileMessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={{
            userId: profile.userId,
            displayName: name,
            avatarUrl: profile.avatarUrl,
            slug: profile.slug,
          }}
        />
      )}
    </div>
  );
}

function Grid({
  items,
  price,
  emptyLabel,
}: {
  items: ProfileListing[];
  price: (usd: number) => string;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-6 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((p) => (
        <Link
          key={p.id}
          to="/product/$id"
          params={{ id: p.id }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#141417] transition-transform hover:-translate-y-0.5"
        >
          <Cover url={p.coverUrl} className="aspect-square w-full" />
          <div className="p-2.5">
            <div className="line-clamp-2 text-xs font-bold leading-snug">{p.title}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs font-black" style={{ color: ACCENT }}>
                {price(p.priceUsd)}
              </span>
              {(p.rating ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
                  <Star className="h-3 w-3 fill-amber-400" strokeWidth={0} />
                  {(p.rating ?? 0).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
