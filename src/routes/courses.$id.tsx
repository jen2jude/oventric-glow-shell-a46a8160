import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MessageCircle,
  Pencil,
  PlayCircle,
  ShoppingBag,
  Star,
  Target,
} from "lucide-react";
import { useRef } from "react";
import { getLiveProfileTab, getProfileSocialCounts } from "@/lib/profiles.functions";
import {
  getShopBranding,
  getShopDiscovery,
  type ShopBranding,
  type ShopDiscovery,
} from "@/lib/shop.functions";
import { listCourses, listMyEnrollments, type CourseDTO } from "@/lib/academy.functions";
import type { ProfileListing } from "@/lib/profiles/mockProfiles";
import { FollowButton } from "@/components/oventric/FollowButton";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { ShopEditModal } from "@/components/oventric/shop/ShopEditModal";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#E5484D";
type Filter = "enrolled" | "selling" | "finished" | "active" | "about";

export const Route = createFileRoute("/courses/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Courses · @${params.id} · Oventric` },
      {
        name: "description",
        content: `Browse courses taught by @${params.id} and explore the Oventric Academy catalogue.`,
      },
      { property: "og:title", content: `Courses · @${params.id} · Oventric` },
      {
        property: "og:description",
        content: `Browse courses taught by @${params.id} and explore the Oventric Academy catalogue.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursesPage,
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
          <GraduationCap className="h-6 w-6 text-white/25" />
        </div>
      )}
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <h2 className="text-base font-black">{title}</h2>
      {action}
    </div>
  );
}

function Rail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) =>
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <div
        ref={ref}
        className="-mx-1 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center sm:flex">
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden items-center sm:flex">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface Tile {
  id: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  priceUsd: number;
  rating?: number;
  done?: boolean;
}

function CourseCard({
  c,
  price,
  wide,
}: {
  c: Tile;
  price: (usd: number) => string;
  wide?: boolean;
}) {
  return (
    <Link
      to="/"
      search={{ section: "Academy", course: c.id } as never}
      className={`shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] ${
        wide ? "w-[78%] sm:w-[46%]" : "w-[46%] sm:w-[28%]"
      }`}
    >
      <Cover url={c.coverUrl} className={wide ? "aspect-[16/10] w-full" : "aspect-[4/3] w-full"} />
      <div className="p-3">
        <div className="line-clamp-2 text-xs font-bold">{c.title}</div>
        <div className="mt-1 line-clamp-1 text-[11px] text-slate-400">
          {c.subtitle || "Oventric Academy"}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-black" style={{ color: ACCENT }}>
            {c.priceUsd > 0 ? price(c.priceUsd) : "Free"}
          </span>
          {c.done ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </span>
          ) : (c.rating ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" strokeWidth={0} /> {(c.rating ?? 0).toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function Grid({
  items,
  price,
  emptyLabel,
}: {
  items: Tile[];
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
      {items.map((c) => (
        <Link
          key={c.id}
          to="/"
          search={{ section: "Academy", course: c.id } as never}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#141417] transition-transform hover:-translate-y-0.5"
        >
          <Cover url={c.coverUrl} className="aspect-[4/3] w-full" />
          <div className="p-2.5">
            <div className="line-clamp-2 text-xs font-bold leading-snug">{c.title}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs font-black" style={{ color: ACCENT }}>
                {c.priceUsd > 0 ? price(c.priceUsd) : "Free"}
              </span>
              {c.done ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Done
                </span>
              ) : (
                <PlayCircle className="h-3.5 w-3.5 text-slate-500" />
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CoursesPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { baseCurrency } = useOnboarding();

  const loadShop = useServerFn(getShopBranding);
  const loadCounts = useServerFn(getProfileSocialCounts);
  const loadTab = useServerFn(getLiveProfileTab);
  const loadDiscovery = useServerFn(getShopDiscovery);
  const loadAll = useServerFn(listCourses);
  const loadEnrollments = useServerFn(listMyEnrollments);

  const [shop, setShop] = useState<ShopBranding | null>(null);
  const [followers, setFollowers] = useState(0);
  const [selling, setSelling] = useState<ProfileListing[]>([]);
  const [sellingTotal, setSellingTotal] = useState(0);
  const [all, setAll] = useState<CourseDTO[]>([]);
  const [enrollments, setEnrollments] = useState<{ courseId: string; completedAt: string | null }[]>(
    [],
  );
  const [discovery, setDiscovery] = useState<ShopDiscovery | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [tab, setTab] = useState<Filter>("selling");
  const [dmOpen, setDmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = useCallback(
    (usd: number) => `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [sym, fx],
  );

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setMeId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setMeId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, c, cs, ac, en] = await Promise.all([
          loadShop({ data: { idOrSlug: id } }),
          loadCounts({ data: { idOrSlug: id } }).catch(() => null),
          loadTab({
            data: { idOrSlug: id, tab: "courses", page: 1, pageSize: 48, q: "", sort: "newest" },
          }).catch(() => null),
          loadAll().catch(() => [] as CourseDTO[]),
          loadEnrollments().catch(() => [] as { courseId: string; completedAt: string | null }[]),
        ]);
        if (cancelled) return;
        setShop(s.shop);
        setFollowers(c?.followers ?? 0);
        const items = (cs?.items ?? []) as ProfileListing[];
        setSelling(items);
        setSellingTotal(cs?.total ?? items.length);
        setAll(ac as CourseDTO[]);
        setEnrollments(en as { courseId: string; completedAt: string | null }[]);

        if (s.shop) {
          const d = await loadDiscovery({ data: { sellerId: s.shop.userId } }).catch(() => null);
          if (!cancelled && d) setDiscovery(d);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, loadShop, loadCounts, loadTab, loadAll, loadEnrollments, loadDiscovery]);

  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const toTile = (c: CourseDTO, done?: boolean): Tile => ({
    id: c.id,
    title: c.title,
    subtitle: c.instructorName || c.category,
    coverUrl: c.coverUrl,
    priceUsd: c.isFree ? 0 : c.priceUSD,
    ...(done === undefined ? {} : { done }),
  });

  const enrolledTiles = useMemo(
    () =>
      enrollments
        .map((e) => {
          const c = byId.get(e.courseId);
          return c ? toTile(c, !!e.completedAt) : null;
        })
        .filter((t): t is Tile => !!t),
    [enrollments, byId],
  );
  const finishedTiles = enrolledTiles.filter((t) => t.done);
  const activeTiles = enrolledTiles.filter((t) => !t.done);

  const sellingTiles: Tile[] = useMemo(
    () =>
      selling.map((l) => ({
        id: l.id,
        title: l.title,
        subtitle: l.blurb?.trim() || l.category,
        coverUrl: l.coverUrl ?? null,
        priceUsd: l.priceUsd,
        ...(l.rating === undefined ? {} : { rating: l.rating }),
      })),
    [selling],
  );

  const featured = useMemo(() => sellingTiles.slice(0, 6), [sellingTiles]);
  const catalogue = useMemo(() => {
    const mine = new Set(sellingTiles.map((t) => t.id));
    return all.filter((c) => !mine.has(c.id)).map((c) => toTile(c));
  }, [all, sellingTiles]);
  const recommendations = useMemo(() => catalogue.slice(0, 12), [catalogue]);

  const name = shop?.shopName ?? id;
  const verified = (shop?.verificationTier ?? "none") !== "none";
  const isOwner = !!meId && !!shop && meId === shop.userId;

  const tabs: [Filter, string, number][] = [
    ["selling", isOwner ? "Courses I'm selling" : "Their courses", sellingTiles.length],
    ["enrolled", "Enrolled courses", enrolledTiles.length],
    ["active", "Active courses", activeTiles.length],
    ["finished", "Finished courses", finishedTiles.length],
    ["about", "About", 0],
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-[#0A0A0B]/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/profile/$id",
              params: { id },
              search: { tab: "courses", pages: 1, y: 0, q: "", sort: "newest" } as never,
            })
          }
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-bold">Creator Course Overview</div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black"
            style={{ backgroundColor: ACCENT }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-[720px] pb-20">
        {/* Cover */}
        <div className="relative h-40 w-full overflow-hidden sm:h-56">
          {shop?.coverUrl ? (
            <img src={shop.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(120deg,#2A1030_0%,#3B1240_55%,#120913_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/30 to-transparent" />
        </div>

        {/* Identity */}
        <div className="-mt-12 px-5">
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-[#141417]">
            {shop?.logoUrl ? (
              <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
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
            {shop?.shopAbout?.trim() || "Courses and learning paths on Oventric Academy."}
          </p>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-[#141417] px-3 py-3 text-center">
            {[
              { v: compact(followers), l: "Followers" },
              { v: compact(sellingTotal), l: "Courses" },
              { v: compact(enrolledTiles.length), l: "Enrolled" },
              { v: compact(finishedTiles.length), l: "Completed" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-sm font-black">{s.v}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black"
                style={{ backgroundColor: ACCENT }}
              >
                <Pencil className="h-4 w-4" /> Edit details
              </button>
            ) : shop?.userId ? (
              <FollowButton
                targetId={shop.userId}
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

          {/* Toggle */}
          <div className="mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map(([key, label, count]) => {
              const on = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
                    on
                      ? "text-white"
                      : "border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                  }`}
                  {...(on ? { style: { backgroundColor: ACCENT } } : {})}
                >
                  {label} {count > 0 && <span className="opacity-80">· {count}</span>}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="mt-6 space-y-3">
              <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
            </div>
          ) : tab === "about" ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#141417] p-4 text-sm leading-relaxed text-slate-300">
              {shop?.shopAbout?.trim() || "This creator hasn't added a description yet."}
              {shop?.country && (
                <div className="mt-3 text-xs text-slate-500">Based in {shop.country}</div>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold"
                  style={{ color: ACCENT }}
                >
                  <Pencil className="h-4 w-4" /> Edit about
                </button>
              )}
            </div>
          ) : tab === "enrolled" || tab === "active" || tab === "finished" ? (
            <Grid
              items={tab === "enrolled" ? enrolledTiles : tab === "active" ? activeTiles : finishedTiles}
              price={price}
              emptyLabel="No courses in this list yet."
            />
          ) : (
            <>
              {featured.length > 0 && (
                <>
                  <SectionHead
                    title="Featured Courses"
                    action={<span className="text-xs font-bold text-slate-400">swipe →</span>}
                  />
                  <Rail>
                    {featured.map((c) => (
                      <CourseCard key={c.id} c={c} price={price} wide />
                    ))}
                  </Rail>
                </>
              )}

              {activeTiles.length > 0 && (
                <>
                  <SectionHead title="Continue learning" />
                  <Rail>
                    {activeTiles.map((c) => (
                      <CourseCard key={c.id} c={c} price={price} />
                    ))}
                  </Rail>
                </>
              )}

              <SectionHead title={isOwner ? "All my courses" : "All courses"} />
              <Grid items={sellingTiles} price={price} emptyLabel="No courses published yet." />

              {recommendations.length > 0 && (
                <>
                  <SectionHead title="Recommended on Oventric Academy" />
                  <Rail>
                    {recommendations.map((c) => (
                      <CourseCard key={c.id} c={c} price={price} />
                    ))}
                  </Rail>
                </>
              )}

              {(discovery?.similarProducts.length ?? 0) > 0 && (
                <>
                  <SectionHead title="Products from Oventric sellers" />
                  <Rail>
                    {discovery!.similarProducts.map((p) => (
                      <Link
                        key={p.id}
                        to="/product/$id"
                        params={{ id: p.id }}
                        className="w-[38%] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#141417] sm:w-[22%]"
                      >
                        <div className="aspect-square w-full overflow-hidden bg-[#1C1C21]">
                          {p.coverUrl ? (
                            <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <ShoppingBag className="h-5 w-5 text-white/25" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="line-clamp-2 text-[11px] font-bold leading-snug">
                            {p.title}
                          </div>
                          <div className="mt-1 text-[11px] font-black" style={{ color: ACCENT }}>
                            {price(p.priceUsd ?? 0)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </Rail>
                </>
              )}

              {(discovery?.blog.length ?? 0) > 0 && (
                <>
                  <SectionHead
                    title="From the Oventric blog"
                    action={
                      <Link to="/blog" className="text-sm font-bold" style={{ color: ACCENT }}>
                        View all
                      </Link>
                    }
                  />
                  <Rail>
                    {discovery!.blog.map((b) => (
                      <Link
                        key={b.id}
                        to="/blog/$slug"
                        params={{ slug: b.id }}
                        className="w-[70%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] sm:w-[42%]"
                      >
                        <Cover url={b.coverUrl} className="aspect-[16/9] w-full" />
                        <div className="p-3">
                          <div className="line-clamp-2 text-xs font-bold">{b.title}</div>
                          <div className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                            {b.subtitle}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </Rail>
                </>
              )}

              {(discovery?.bounties.length ?? 0) > 0 && (
                <>
                  <SectionHead title="Open bounties" />
                  <Rail>
                    {discovery!.bounties.map((b) => (
                      <div
                        key={b.id}
                        className="w-[62%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#141417] p-3 sm:w-[36%]"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                          <Target className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                          {b.subtitle ?? "Bounty"}
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-xs font-bold">{b.title}</div>
                        <div className="mt-2 text-sm font-black" style={{ color: ACCENT }}>
                          {price(b.priceUsd ?? 0)}
                        </div>
                      </div>
                    ))}
                  </Rail>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {shop?.userId && (
        <ProfileMessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={{
            userId: shop.userId,
            displayName: name,
            avatarUrl: shop.logoUrl,
            slug: shop.slug,
          }}
        />
      )}

      {isOwner && shop && (
        <ShopEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          shop={shop}
          userId={shop.userId}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
