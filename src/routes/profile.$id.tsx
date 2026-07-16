import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  getCircleStatus,
  sendCircleRequest,
  cancelCircleRequest,
  type CircleStatus,
} from "@/lib/circles.functions";
import { getLiveProfileTab, getLiveReputation, getProfileByIdOrSlug, getProfileSocialCounts, updateMyProfile, type LiveReputation, type ProfileSocialCounts, type RealProfileView, type ProfileTabPage, type ProfileSortKey } from "@/lib/profiles.functions";
import type {
  ProfilePost,
  ProfileGroup,
  ProfileListing,
  ProfileBounty,
} from "@/lib/profiles/mockProfiles";
import {
  ArrowLeft,
  Star,
  MessageCircle,
  UserPlus,
  Check,
  Users,
  ShoppingBag,
  Target,
  Award,
  ShieldCheck,
  X,
  Flag,
  ExternalLink,
  Link2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Clock,
  Loader2,
  Camera,

} from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getProfile, computeStarBreakdown, getCircleMembersPreview } from "@/lib/profiles/mockProfiles";
import { ReportModal } from "@/components/oventric/ReportModal";
import { CircleRequestsDrawer } from "@/components/oventric/CircleRequestsDrawer";
import { FollowRequestsDrawer } from "@/components/oventric/FollowRequestsDrawer";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { FollowButton } from "@/components/oventric/FollowButton";
import { JoinCirclePickerModal } from "@/components/oventric/JoinCirclePickerModal";
import { ResponsiveImage } from "@/components/ui/responsive-image";

const profileSearchSchema = z.object({
  tab: fallback(z.string(), "posts").default("posts"),
  pages: fallback(z.number().int(), 1).default(1),
  y: fallback(z.number().int(), 0).default(0),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "newest").default("newest"),
});


export const Route = createFileRoute("/profile/$id")({
  validateSearch: zodValidator(profileSearchSchema),
  head: ({ params }) => ({
    meta: [
      { title: `@${params.id} · Oventric` },
      { name: "description", content: `Profile, listings, and bounties for ${params.id} on Oventric.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type Tab = "posts" | "groups" | "marketplace" | "posted" | "solved";
const TAB_KEYS: Tab[] = ["posts", "groups", "marketplace", "posted", "solved"];
const isTab = (v: string): v is Tab => (TAB_KEYS as string[]).includes(v);



type SortOption = { value: ProfileSortKey; label: string };
const SORT_OPTIONS_BY_TAB: Record<Tab, SortOption[]> = {
  posts: [
    { value: "newest", label: "Newest" },
    { value: "most_liked", label: "Most liked" },
    { value: "most_commented", label: "Most commented" },
  ],
  groups: [
    { value: "newest", label: "Newest" },
    { value: "most_members", label: "Most members" },
    { value: "alpha", label: "A – Z" },
  ],
  marketplace: [
    { value: "newest", label: "Newest" },
    { value: "price_low", label: "Price: low to high" },
    { value: "price_high", label: "Price: high to low" },
    { value: "most_sold", label: "Most sold" },
    { value: "alpha", label: "A – Z" },
  ],
  posted: [
    { value: "newest", label: "Newest" },
    { value: "highest_bounty", label: "Highest bounty" },
    { value: "lowest_bounty", label: "Lowest bounty" },
    { value: "most_applicants", label: "Most applicants" },
  ],
  solved: [
    { value: "newest", label: "Newest" },
    { value: "highest_bounty", label: "Highest bounty" },
    { value: "lowest_bounty", label: "Lowest bounty" },
  ],
};
const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  posts: "Search posts…",
  groups: "Search groups…",
  marketplace: "Search listings…",
  posted: "Search bounties…",
  solved: "Search solved bounties…",
};

function ProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const profile = useMemo(() => getProfile(id), [id]);
  const { require, baseCurrency } = useOnboarding();

  const tab: Tab = isTab(search.tab) ? search.tab : "posts";
  const desiredPages = Math.max(1, Math.min(200, search.pages || 1));
  const restoreY = Math.max(0, search.y || 0);
  const q = (search.q || "").trim();
  const sort = SORT_OPTIONS_BY_TAB[tab].some((o) => o.value === search.sort)
    ? (search.sort as ProfileSortKey)
    : "newest";

  // Search state to hand off to item detail pages so their back link returns
  // to the exact tab, pagination depth, and scroll position we're in.
  const itemSearch = { tab, pages: desiredPages, y: restoreY, q, sort };


  const [circle, setCircle] = useState<CircleStatus>("none");
  const [circleBusy, setCircleBusy] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [circleMeta, setCircleMeta] = useState<{
    sentAt: string | null;
    acceptedAt: string | null;
    canceledAt: string | null;
  }>({ sentAt: null, acceptedAt: null, canceledAt: null });
  const [dmOpen, setDmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [joinCircleOpen, setJoinCircleOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [followRequestsOpen, setFollowRequestsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mpLastRefreshed, setMpLastRefreshed] = useState<number | null>(null);
  const [mpRefreshing, setMpRefreshing] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const mpPagesRef = useRef(1);

  // Per-tab paginated data. Items accumulate on "Load more".
  type TabState = {
    items: ProfileTabPage["items"];
    page: number;
    total: number | null;
    hasMore: boolean;
    loading: boolean;
    error: string | null;
  };
  const emptyTabState: TabState = {
    items: [],
    page: 0,
    total: null,
    hasMore: true,
    loading: false,
    error: null,
  };
  const [tabData, setTabData] = useState<Record<Tab, TabState>>({
    posts: { ...emptyTabState },
    groups: { ...emptyTabState },
    marketplace: { ...emptyTabState },
    posted: { ...emptyTabState },
    solved: { ...emptyTabState },
  });
  const PAGE_SIZE = 6;

  const fetchTab = useServerFn(getLiveProfileTab);
  const fetchStatus = useServerFn(getCircleStatus);
  const sendReq = useServerFn(sendCircleRequest);
  const cancelReq = useServerFn(cancelCircleRequest);
  const fetchRealProfile = useServerFn(getProfileByIdOrSlug);
  const fetchReputation = useServerFn(getLiveReputation);
  const fetchSocialCounts = useServerFn(getProfileSocialCounts);

  const [realProfile, setRealProfile] = useState<RealProfileView | null>(null);
  const [realProfileLoaded, setRealProfileLoaded] = useState(false);
  const [liveRep, setLiveRep] = useState<LiveReputation | null>(null);
  const [socialCounts, setSocialCounts] = useState<ProfileSocialCounts | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setMeId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setMeId(session?.user?.id ?? null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  const reloadSocialCounts = useCallback(() => {
    fetchSocialCounts({ data: { idOrSlug: id } })
      .then((c) => setSocialCounts(c))
      .catch(() => {});
  }, [fetchSocialCounts, id]);

  useEffect(() => {
    let cancelled = false;
    setRealProfileLoaded(false);
    setRealProfile(null);
    (async () => {
      try {
        const [pRes, rRes, cRes] = await Promise.all([
          fetchRealProfile({ data: { idOrSlug: id } }),
          fetchReputation({ data: { idOrSlug: id } }),
          fetchSocialCounts({ data: { idOrSlug: id } }),
        ]);
        if (cancelled) return;
        setRealProfile(pRes.profile);
        setLiveRep(rRes.reputation);
        setSocialCounts(cRes);
      } catch (e) {
        console.error("[profile] real load failed", e);
      } finally {
        if (!cancelled) setRealProfileLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchRealProfile, fetchReputation, fetchSocialCounts]);

  // Realtime: keep followers / circle members counters in sync with reality.
  useEffect(() => {
    const uid =
      realProfile?.userId ??
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : socialCounts?.userId ?? null);
    if (!uid) return;
    const ch = supabase
      .channel(`profile-social-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `followee_id=eq.${uid}` },
        () => reloadSocialCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${uid}` },
        () => reloadSocialCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_members", filter: `user_id=eq.${uid}` },
        () => reloadSocialCounts(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realProfile?.userId, id]);

  // Pending incoming follow-request count (own profile) — powers the RGB glow dot
  // on the "Follow Requests" trigger.
  const [pendingFollowReqCount, setPendingFollowReqCount] = useState(0);
  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("follow_requests")
        .select("id", { count: "exact", head: true })
        .eq("target_id", meId)
        .eq("status", "pending");
      if (!cancelled) setPendingFollowReqCount(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`follow-req-count-${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_requests", filter: `target_id=eq.${meId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [meId]);


  const isUuidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isOwnProfile = !!(meId && (meId === id || (realProfile && meId === realProfile.userId)));



  const mainRef = useRef<HTMLElement | null>(null);
  const scrollRestoredRef = useRef(false);

  // Fetch a specific page (1-indexed). Returns the fetched response.
  const fetchOne = useCallback(
    async (which: Tab, pageNum: number, reset: boolean, filters: { q: string; sort: ProfileSortKey }) => {
      const res = await fetchTab({
        data: {
          idOrSlug: id,
          tab: which,
          page: pageNum,
          pageSize: PAGE_SIZE,
          q: filters.q,
          sort: filters.sort,
        },
      });

      setTabData((s) => ({
        ...s,
        [which]: {
          items: reset ? res.items : [...s[which].items, ...res.items],
          page: res.page,
          total: res.total,
          hasMore: res.hasMore,
          loading: false,
          error: null,
        },
      }));
      return res;
    },
    [profile.id, fetchTab],
  );


  // Load next page for a tab (used by "Load more"). Syncs URL.
  const loadMore = useCallback(async () => {
    const current = tabData[tab];
    if (current.loading || !current.hasMore) return;
    setTabData((s) => ({ ...s, [tab]: { ...s[tab], loading: true, error: null } }));
    const nextPage = (current.page || 0) + 1;
    try {
      await fetchOne(tab, nextPage, false, { q, sort });
      const y = mainRef.current?.scrollTop ?? 0;
      navigate({
        to: "/profile/$id",
        params: { id },
        search: (prev: z.infer<typeof profileSearchSchema>) => ({ ...prev, tab, pages: nextPage, y }),
        replace: true,
      });
    } catch (e) {
      console.error(e);
      setTabData((s) => ({
        ...s,
        [tab]: { ...s[tab], loading: false, error: "Couldn't load. Try again." },
      }));
    }
  }, [tab, tabData, fetchOne, navigate, id, q, sort]);

  // Change tabs — resets pagination and scroll in the URL.
  const changeTab = useCallback(
    (next: Tab) => {
      if (next === tab) return;
      scrollRestoredRef.current = true; // no restore for a fresh tab
      navigate({
        to: "/profile/$id",
        params: { id },
        search: { tab: next, pages: 1, y: 0 },
        replace: true,
      });
      if (mainRef.current) mainRef.current.scrollTop = 0;
    },
    [tab, navigate, id],
  );

  // Retry a failed tab: clear its cache so the load effect refetches up to
  // the current desiredPages (preserving pagination). Also reset scroll.
  const retryTab = useCallback(
    (which: Tab) => {
      scrollRestoredRef.current = true; // don't try to restore old scroll
      setTabData((s) => ({ ...s, [which]: { ...emptyTabState } }));
      navigate({
        to: "/profile/$id",
        params: { id },
        search: (prev: z.infer<typeof profileSearchSchema>) => ({ ...prev, tab: which, y: 0 }),
        replace: true,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, id],
  );



  // Load (or reload) the active tab up to `desiredPages`, then restore scroll.
  useEffect(() => {
    let cancelled = false;
    const state = tabData[tab];
    // Only trigger the initial hydration for this tab.
    if (state.page !== 0 || state.loading) return;
    (async () => {
      setTabData((s) => ({ ...s, [tab]: { ...s[tab], loading: true, error: null } }));
      try {
        let last = await fetchOne(tab, 1, true, { q, sort });
        for (let p = 2; p <= desiredPages && last.hasMore && !cancelled; p++) {
          last = await fetchOne(tab, p, false, { q, sort });
        }
        if (cancelled) return;
        // Restore scroll after content is on the page.
        requestAnimationFrame(() => {
          if (!scrollRestoredRef.current && mainRef.current && restoreY > 0) {
            mainRef.current.scrollTop = restoreY;
          }
          scrollRestoredRef.current = true;
        });
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setTabData((s) => ({
          ...s,
          [tab]: { ...s[tab], loading: false, error: "Couldn't load. Try again." },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile.id, q, sort]);

  // Reset caches when navigating to a different profile.
  useEffect(() => {
    scrollRestoredRef.current = false;
    setTabData({
      posts: { ...emptyTabState },
      groups: { ...emptyTabState },
      marketplace: { ...emptyTabState },
      posted: { ...emptyTabState },
      solved: { ...emptyTabState },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // When search query or sort changes, invalidate the current tab so it
  // reloads with the new filters. Pagination in the URL is reset to 1.
  useEffect(() => {
    scrollRestoredRef.current = true; // don't restore old scroll for a new query
    setTabData((s) => ({ ...s, [tab]: { ...emptyTabState } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, tab]);


  // Persist scroll position into the URL (throttled) so reloads restore it.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let raf = 0;
    let lastWritten = restoreY;
    const onScroll = () => {
      if (!scrollRestoredRef.current) return;
      if (raf) return;
      raf = window.setTimeout(() => {
        raf = 0;
        const y = Math.round(el.scrollTop);
        if (Math.abs(y - lastWritten) < 40) return;
        lastWritten = y;
        navigate({
          to: "/profile/$id",
          params: { id },
          search: (prev: z.infer<typeof profileSearchSchema>) => ({ ...prev, y }),
          replace: true,
        });
      }, 200) as unknown as number;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.clearTimeout(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile.id]);




  // Ensure an auth session exists (anonymous is fine for the demo)
  const ensureSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
  };

  const circleTargetSlug = realProfile?.slug ?? profile.id;

  // Load initial status for this profile — keyed to the real profile slug once
  // it resolves so the button reflects the actual circle_requests row.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await ensureSession();
        const res = await fetchStatus({ data: { targetSlug: circleTargetSlug } });
        if (cancelled) return;
        setCircle(res.status);
        setCircleMeta({
          sentAt: res.sentAt,
          acceptedAt: res.status === "accepted" ? res.updatedAt : null,
          canceledAt: null,
        });
      } catch (e) {
        console.error(e);
      }
    };
    void load();
    // Refetch when the tab regains focus so acceptance by the target user
    // flips the button from Pending → In Circle without a manual reload.
    const onFocus = () => void load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [circleTargetSlug, fetchStatus]);



  const rep = profile.reputation;
  const starBreakdown = useMemo(() => computeStarBreakdown(rep), [rep]);
  const circleMembers = useMemo(() => getCircleMembersPreview(profile), [profile]);
  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = (usd: number) =>
    `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: baseCurrency === "USD" ? 0 : 0 })}`;

  // Real-profile overlay. When we have a live row, prefer its identity fields
  // over the deterministic mock so the header shows the real person.
  // When the URL id is a raw UUID, don't derive garbage names/initials from
  // it — wait for the real row or show a clean placeholder.
  const hasRealProfile = !!realProfile;
  const identityPending = isUuidId && !realProfileLoaded && !hasRealProfile;
  const identityMissing = isUuidId && realProfileLoaded && !hasRealProfile;
  const displayName = hasRealProfile
    ? realProfile!.displayName || "Unnamed member"
    : isUuidId
      ? identityPending ? "Loading profile…" : "Profile unavailable"
      : profile.name;
  const displayInitials = (() => {
    if (hasRealProfile) {
      const source = realProfile!.displayName || "";
      const parts = source.trim().split(/\s+/).slice(0, 2);
      const s = parts.map((w) => w[0]?.toUpperCase() ?? "").join("");
      return s || "??";
    }
    if (isUuidId) return "··";
    return profile.initials;
  })();
  const displayBio = hasRealProfile ? realProfile!.bio ?? "" : isUuidId ? "" : profile.bio;
  const displayRole = hasRealProfile
    ? (realProfile!.username ? `@${realProfile!.username}` : "Member")
    : isUuidId ? "" : profile.role;
  const displayJoined = hasRealProfile
    ? new Date(realProfile!.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : isUuidId ? "—" : profile.joined;
  const displayAvatar = realProfile?.avatarUrl ?? null;
  const displayTierLabel = hasRealProfile
    ? realProfile!.verificationTier === "TIER_0"
      ? "Unverified"
      : `${realProfile!.verificationTier.replace("_", " ")} Verified`
    : isUuidId ? "Unverified" : "Verified";
  const displayStars = liveRep?.stars ?? realProfile?.reputationStars ?? (isUuidId ? 0 : starBreakdown.stars);
  

  const handleJoin = () => {
    require(1, async () => {
      setCircleBusy(true);
      setCircleError(null);
      try {
        await ensureSession();
        if (circle === "none") {
          const res = await sendReq({ data: { targetSlug: circleTargetSlug } });
          setCircle(res.status);
          setCircleMeta({ sentAt: res.sentAt, acceptedAt: null, canceledAt: null });
        } else if (circle === "pending") {
          const res = await cancelReq({ data: { targetSlug: circleTargetSlug } });
          setCircle(res.status);
          setCircleMeta((m) => ({ sentAt: m.sentAt, acceptedAt: null, canceledAt: res.canceledAt }));
        }
      } catch (e) {
        console.error(e);
        setCircleError("Something went wrong. Try again.");
      } finally {
        setCircleBusy(false);
      }
    });
  };
  const handleChat = () => require(1, () => setDmOpen(true));
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail
    }
  };

  // Track how many marketplace pages are currently loaded so background
  // refreshes rehydrate the same window the user is viewing.
  useEffect(() => {
    mpPagesRef.current = Math.max(1, tabData.marketplace.page || 1);
  }, [tabData.marketplace.page]);

  // Silently refetch all currently-loaded marketplace pages and replace items
  // in place. Used by the auto-refresh interval and the manual Refresh button.
  const refreshMarketplace = useCallback(async () => {
    setMpRefreshing(true);
    try {
      const pagesToLoad = mpPagesRef.current;
      const collected: ProfileTabPage["items"] = [];
      let last: ProfileTabPage | null = null;
      for (let p = 1; p <= pagesToLoad; p++) {
        const res: ProfileTabPage = await fetchTab({
          data: { idOrSlug: id, tab: "marketplace", page: p, pageSize: PAGE_SIZE, q, sort },
        });
        last = res;
        collected.push(...res.items);
        if (!res.hasMore) break;
      }

      setTabData((s) => ({
        ...s,
        marketplace: {
          items: collected,
          page: last?.page ?? s.marketplace.page,
          total: last?.total ?? s.marketplace.total,
          hasMore: last?.hasMore ?? s.marketplace.hasMore,
          loading: false,
          error: null,
        },
      }));
      setMpLastRefreshed(Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      setMpRefreshing(false);
    }
  }, [id, q, sort, fetchTab]);

  // Seed the "last updated" timestamp when marketplace items first appear.
  useEffect(() => {
    if (tab === "marketplace" && tabData.marketplace.items.length > 0 && mpLastRefreshed === null) {
      setMpLastRefreshed(Date.now());
    }
  }, [tab, tabData.marketplace.items.length, mpLastRefreshed]);

  // Auto-refresh marketplace every 15s while the tab is active. Also drives a
  // 1s ticker so the "Xs ago" label stays accurate without extra state.
  useEffect(() => {
    if (tab !== "marketplace") return;
    const refresh = window.setInterval(() => { refreshMarketplace(); }, 15000);
    const tick = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [tab, refreshMarketplace]);

  const mpAgoLabel = (() => {
    if (mpLastRefreshed === null) return "syncing…";
    const s = Math.max(0, Math.floor((nowTick - mpLastRefreshed) / 1000));
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    return `${m}m ago`;
  })();



  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />


      <div className="flex h-full flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="max-w-3xl mx-auto w-full px-4 py-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                onClick={() => navigate({ to: "/" })}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to feed
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E24] border border-white/10 hover:border-emerald-500/40 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                  aria-label="Copy profile link"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                {isOwnProfile && (
                  <button
                    onClick={() => setFollowRequestsOpen(true)}
                    className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E24] border border-white/10 hover:border-sky-500/40 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                    aria-label={`Open follow requests${pendingFollowReqCount > 0 ? ` (${pendingFollowReqCount} pending)` : ""}`}
                  >
                    <UserPlus className="w-3.5 h-3.5 text-sky-300" />
                    Follow Requests
                    {pendingFollowReqCount > 0 && (
                      <span
                        className="rgb-pulse-glow absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center"
                        aria-hidden
                      >
                        {pendingFollowReqCount > 9 ? "9+" : pendingFollowReqCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Hero — solid background on mobile, no aggressive compositing
                 hints. Earlier versions used `contain: layout paint`,
                 `will-change: transform`, and `isolation: isolate` which
                 corrupted GPU rasterization on some Android Chromium builds,
                 producing scanline / static noise between the reputation
                 stat grid and the rating breakdown. Keep the background
                 flat; let the browser composite normally. */}
            <section
              data-testid="profile-banner"
              className="bg-[#1E1E24] sm:bg-gradient-to-b sm:from-[#1E1E24] sm:to-[#121214] border border-white/10 rounded-xl p-4 sm:p-6"
              style={{ overscrollBehavior: "contain" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div
                  className={`w-20 h-20 rounded-full bg-gradient-to-br ${profile.avatarGradient} flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-lg overflow-hidden`}
                >
                  {displayAvatar ? (
                    <ResponsiveImage
                      src={displayAvatar}
                      alt={`${displayName} avatar`}
                      sizes="80px"
                      className="w-full h-full object-cover"
                    />

                  ) : (
                    displayInitials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-white text-2xl font-black">{displayName}</h1>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" aria-label={displayTierLabel} />
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                      {displayTierLabel}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5">{displayRole}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Joined {displayJoined} · ★ {displayStars.toFixed(1)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-slate-300">
                      <span className="font-bold text-white">{(socialCounts?.followers ?? 0).toLocaleString()}</span>{" "}
                      <span className="text-slate-500">followers</span>
                    </span>
                    <span className="text-slate-300">
                      <span className="font-bold text-white">{(socialCounts?.following ?? 0).toLocaleString()}</span>{" "}
                      <span className="text-slate-500">following</span>
                    </span>
                    <span className="text-slate-300">
                      <span className="font-bold text-white">{(socialCounts?.circleMembers ?? 0).toLocaleString()}</span>{" "}
                      <span className="text-slate-500">in circle</span>
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                    {displayBio || <span className="text-slate-500 italic">No bio yet.</span>}
                  </p>
                  <div className="mt-3 flex items-center gap-2.5" aria-label={`${socialCounts?.circleMembers ?? 0} members in ${displayName}'s circle`}>
                    <div className="flex -space-x-2">
                      {circleMembers.preview.slice(0, Math.min(circleMembers.preview.length, socialCounts?.circleMembers ?? 0)).map((m) => (
                        <div
                          key={m.id}
                          title={m.name}
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${m.avatarGradient} ring-2 ring-[#1E1E24] flex items-center justify-center text-[10px] font-bold text-white`}
                        >
                          {m.initials}
                        </div>
                      ))}
                      {(socialCounts?.circleMembers ?? 0) > circleMembers.preview.length && (
                        <div className="w-7 h-7 rounded-full bg-white/10 ring-2 ring-[#1E1E24] flex items-center justify-center text-[10px] font-bold text-slate-200">
                          +{Math.max(0, (socialCounts?.circleMembers ?? 0) - circleMembers.preview.length)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">{(socialCounts?.circleMembers ?? 0).toLocaleString()}</span> in circle
                    </span>
                  </div>

                </div>
                {!isOwnProfile && !identityMissing && realProfile?.userId && (
                <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
                  <FollowButton targetId={realProfile.userId} className="w-full" />
                  <button
                    onClick={() => setJoinCircleOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-sm font-semibold"
                    aria-label="Request to join one of this user's circles"
                  >
                    <Users className="w-4 h-4" /> Join Circle
                  </button>
                  <button
                    onClick={handleChat}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white hover:bg-white/5 text-sm font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" /> Chat
                  </button>
                  <button
                    onClick={() => setReportOpen(true)}
                    className="hidden sm:inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:bg-white/5 text-xs"
                  >
                    <Flag className="w-3.5 h-3.5" /> Report
                  </button>
                </div>
                )}
                {isOwnProfile && (
                  <div className="hidden sm:flex flex-col gap-2 sm:w-44 shrink-0">
                    <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
                      This is your profile
                    </div>
                    <button
                      onClick={() => navigate({ to: "/" })}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white hover:bg-white/5 text-sm font-semibold"
                    >
                      Back to feed
                    </button>
                  </div>
                )}
              </div>

              {/* Reputation block */}
              <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                <RepStat
                  icon={<Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                  label="Star Rating"
                  value={
                    <div className="flex items-center gap-1">
                      <span className="text-white font-black">{displayStars.toFixed(1)}</span>
                      <StarRow value={displayStars} />
                    </div>
                  }
                />
                <RepStat
                  icon={<Target className="w-4 h-4 text-emerald-400" />}
                  label="Bounties Solved"
                  value={
                    <span className="text-white font-black">
                      {liveRep ? liveRep.metrics.bountiesSolved : "…"}
                    </span>
                  }
                />
                <RepStat
                  icon={<Award className="w-4 h-4 text-purple-400" />}
                  label="Product Rating"
                  value={
                    <span className="text-white font-black">
                      {liveRep
                        ? liveRep.metrics.productReviewCount > 0
                          ? liveRep.metrics.avgProductRating.toFixed(1)
                          : "—"
                        : "…"}
                    </span>
                  }
                />
                <RepStat
                  icon={<ShoppingBag className="w-4 h-4 text-sky-400" />}
                  label="Listings"
                  value={
                    <span className="text-white font-black">
                      {liveRep ? liveRep.metrics.productsListed : "…"}
                    </span>
                  }
                />
                <RepStat
                  icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                  label="Posts (30d)"
                  value={
                    <span className="text-white font-black">
                      {liveRep ? liveRep.metrics.postsLast30d : "…"}
                    </span>
                  }
                />
              </div>

              {/* Star rating derivation */}
              <div className="mt-4 rounded-lg border border-white/5 bg-[#17171C] p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      How this rating is calculated
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {liveRep ? "Weighted from live activity" : "Loading live metrics…"}
                  </span>
                </div>
                {!liveRep ? (
                  <div className="py-6 text-center text-[11px] text-slate-500">
                    Fetching real metrics from bounties, marketplace, and posts…
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {liveRep.items.map((item) => (
                      <li
                        key={item.key}
                        className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3"
                      >
                        <div className="sm:w-28 shrink-0 flex items-baseline justify-between sm:block gap-2">
                          <div className="text-xs text-white font-semibold">{item.label}</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            {Math.round(item.weight * 100)}% weight
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-slate-400 leading-snug">{item.detail}</div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-yellow-400"
                              style={{ width: `${Math.round(item.score * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="sm:w-24 shrink-0 flex items-baseline justify-between sm:block sm:text-right">
                          <div className="text-xs font-bold text-white">{item.raw}</div>
                          <div className="text-[10px] text-slate-500">
                            {(item.score * 5).toFixed(1)} / 5
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>



            {/* Tabs */}
            <nav className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/10">
              {(
                [
                  ["posts", "Posts"],
                  ["groups", "Groups"],
                  ["marketplace", "Marketplace"],
                  ["posted", "Bounties Posted"],
                  ["solved", "Bounties Solved"],
                ] as [Tab, string][]
              ).map(([key, label]) => {
                const count = tabData[key].total;
                return (
                  <button
                    key={key}
                    onClick={() => changeTab(key)}
                    className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                      tab === key
                        ? "text-emerald-400 border-emerald-400"
                        : "text-slate-400 border-transparent hover:text-white"
                    }`}
                  >
                    {label}
                    <span className="text-xs text-slate-500 ml-1">
                      ({count === null ? "…" : count})
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Search + sort */}
            <TabFilters
              tab={tab}
              q={q}
              sort={sort}
              onChangeQ={(next) => {
                navigate({
                  to: "/profile/$id",
                  params: { id },
                  search: (prev: z.infer<typeof profileSearchSchema>) => ({
                    ...prev,
                    q: next,
                    pages: 1,
                    y: 0,
                  }),
                  replace: true,
                });
              }}
              onChangeSort={(next) => {
                navigate({
                  to: "/profile/$id",
                  params: { id },
                  search: (prev: z.infer<typeof profileSearchSchema>) => ({
                    ...prev,
                    sort: next,
                    pages: 1,
                    y: 0,
                  }),
                  replace: true,
                });
              }}
            />

            {/* Live refresh indicator for the marketplace tab */}
            {tab === "marketplace" && (
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <div className="inline-flex items-center gap-1.5 text-slate-400">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      mpRefreshing ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"
                    }`}
                    aria-hidden
                  />
                  <span className="font-semibold text-emerald-300">Live prices</span>
                  <span className="text-slate-500">· Last updated {mpAgoLabel}</span>
                </div>
                <button
                  onClick={refreshMarketplace}
                  disabled={mpRefreshing}
                  className="text-slate-400 hover:text-emerald-400 disabled:opacity-50 font-semibold"
                  aria-label="Refresh marketplace prices"
                >
                  {mpRefreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            )}



            {/* Tab content */}
            <section className="mt-5 space-y-3">
              {(() => {
                const st = tabData[tab];
                const initialLoading = st.loading && st.items.length === 0;
                const isEmpty = !st.loading && st.items.length === 0 && !st.error;

                if (st.error && st.items.length === 0) {
                  return (
                    <ErrorState
                      label="Couldn't load this tab"
                      hint={`We'll refetch ${desiredPages > 1 ? `pages 1–${desiredPages}` : "page 1"} of ${tabNoun(tab)}.`}
                      onRetry={() => retryTab(tab)}
                    />
                  );
                }
                if (initialLoading) return <TabSkeleton variant={tab} />;
                if (isEmpty) {
                  const empty = emptyContentFor(tab, profile.name, q, () => {
                    navigate({
                      to: "/profile/$id",
                      params: { id },
                      search: (prev: z.infer<typeof profileSearchSchema>) => ({
                        ...prev,
                        q: "",
                        pages: 1,
                        y: 0,
                      }),
                      replace: true,
                    });
                  });
                  return <EmptyState {...empty} />;
                }


                return (
                  <>
                    {tab === "posts" && (
                      <>
                        {(st.items as ProfilePost[]).map((p) => (
                          <Link
                            key={p.id}
                            to="/profile/$id/item/$kind/$itemId"
                            params={{ id: profile.id, kind: "post", itemId: p.id }} search={itemSearch}
                            className="block bg-[#1E1E24] border border-white/10 rounded-xl p-5 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                              <span>{profile.name}</span>
                              <span>·</span>
                              <span>{p.timeAgo}</span>
                            </div>
                            <p className="text-sm text-slate-200 leading-relaxed">{p.content}</p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                              <span>❤ {p.likes}</span>
                              <span>💬 {p.comments}</span>
                            </div>
                          </Link>
                        ))}
                      </>
                    )}

                    {tab === "groups" && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(st.items as ProfileGroup[]).map((g) => (
                          <Link
                            key={g.id}
                            to="/profile/$id/item/$kind/$itemId"
                            params={{ id: profile.id, kind: "group", itemId: g.id }} search={itemSearch}
                            className="block bg-[#1E1E24] border border-white/10 rounded-xl p-4 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-black font-black">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-semibold text-sm truncate">
                                  {g.name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {g.tag} · {g.members.toLocaleString()} members
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {tab === "marketplace" && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(st.items as ProfileListing[]).map((l) => (
                          <Link
                            key={l.id}
                            to="/profile/$id/item/$kind/$itemId"
                            params={{ id: profile.id, kind: "listing", itemId: l.id }} search={itemSearch}
                            className="block bg-[#1E1E24] border border-white/10 rounded-xl p-4 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                              {l.category}
                            </div>
                            <div className="text-white font-semibold text-sm mt-1">{l.title}</div>
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-white font-black text-lg">
                                {price(l.priceUsd)}
                              </div>
                              <div className="text-[11px] text-slate-500">{l.sales} sold</div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                require(2, () => alert("Proceed to checkout (mock)"));
                              }}
                              className="mt-3 w-full px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs"
                            >
                              Buy Now
                            </button>
                          </Link>
                        ))}
                      </div>
                    )}

                    {tab === "posted" &&
                      (st.items as ProfileBounty[]).map((b) => (
                        <Link
                          key={b.id}
                          to="/profile/$id/item/$kind/$itemId"
                          params={{ id: profile.id, kind: "bounty", itemId: b.id }} search={itemSearch}
                          className="block bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-5 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-300 mb-2">
                            <Target className="w-3.5 h-3.5" />
                            [ACTIVE · {price(b.amountUsd)}]
                          </div>
                          <h3 className="text-white font-bold leading-snug">{b.title}</h3>
                          <div className="text-xs text-slate-500 mt-2">
                            <Users className="w-3.5 h-3.5 inline mr-1" />
                            {b.applicants ?? 0} applicants
                          </div>
                        </Link>
                      ))}

                    {tab === "solved" &&
                      (st.items as ProfileBounty[]).map((b) => (
                        <Link
                          key={b.id}
                          to="/profile/$id/item/$kind/$itemId"
                          params={{ id: profile.id, kind: "solved", itemId: b.id }} search={itemSearch}
                          className="block bg-[#1E1E24] border border-white/10 rounded-xl p-5 hover:border-purple-400/40 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-2 text-[11px] font-bold text-purple-300 mb-2">
                            <Award className="w-3.5 h-3.5" />
                            [SOLVED · {price(b.amountUsd)}]
                          </div>
                          <h3 className="text-white font-bold leading-snug">{b.title}</h3>
                          {b.proof && (
                            <div className="mt-3 bg-black/30 border border-white/5 rounded-lg p-3">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                Technical execution proof
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{b.proof}</p>
                              <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                View artifact <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          )}
                        </Link>
                      ))}


                    {/* Pagination footer */}
                    <div className="pt-2 flex items-center justify-center">
                      {st.hasMore ? (
                        <button
                          onClick={() => loadMore()}
                          disabled={st.loading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-50"
                        >
                          {st.loading ? "Loading…" : `Load more (${(st.total ?? 0) - st.items.length} left)`}
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-500">
                          You've reached the end · {st.items.length} of {st.total}
                        </div>
                      )}
                    </div>
                    {st.error && st.items.length > 0 && (
                      <div className="flex items-center justify-center gap-2 text-[11px] text-red-300">
                        <span>{st.error}</span>
                        <button
                          onClick={() => retryTab(tab)}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          <RefreshCw className="w-3 h-3" /> Try again
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          </div>
        </main>
        <MobileNav
          onCreate={() => require(1)}
          active="Feed"
          onSelect={(l) => navigate({ to: "/" })}
        />
      </div>

      <MessagesDrawer
        open={dmOpen && !!realProfile?.userId}
        onClose={() => setDmOpen(false)}
        initialThreadId={realProfile?.userId}
      />
      <CircleRequestsDrawer open={requestsOpen} onClose={() => setRequestsOpen(false)} />
      <FollowRequestsDrawer open={followRequestsOpen} onClose={() => setFollowRequestsOpen(false)} />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={profile.name}
        targetId={`profile-${profile.id}`}
        targetKind="profile"
      />
      {realProfile?.userId && (
        <JoinCirclePickerModal
          open={joinCircleOpen}
          onClose={() => setJoinCircleOpen(false)}
          userId={realProfile.userId}
          userName={realProfile.displayName || profile.name}
        />
      )}
    </div>
  );
}

function RepStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-black/30 border border-white/5 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function relTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function absTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function CircleStatusNote({
  status,
  meta,
  firstName,
}: {
  status: CircleStatus;
  meta: { sentAt: string | null; acceptedAt: string | null; canceledAt: string | null };
  firstName: string;
}) {
  const sent = relTime(meta.sentAt);
  const accepted = relTime(meta.acceptedAt);
  const canceled = relTime(meta.canceledAt);

  if (status === "accepted") {
    return (
      <div className="text-[11px] text-emerald-300/90 sm:text-center leading-snug px-1 space-y-0.5">
        {accepted && (
          <div>
            <span title={absTime(meta.acceptedAt)}>Accepted {accepted}</span>
          </div>
        )}
        {sent && (
          <div className="text-slate-500">
            <span title={absTime(meta.sentAt)}>Request sent {sent}</span>
          </div>
        )}
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="text-[11px] text-slate-400 sm:text-center leading-snug px-1 space-y-0.5">
        {sent && (
          <div>
            <span title={absTime(meta.sentAt)}>Sent {sent}</span>
          </div>
        )}
        <div className="text-slate-500">Waiting on {firstName} to accept from their inbox.</div>
      </div>
    );
  }

  // status === "none"
  if (canceled) {
    return (
      <div className="text-[11px] text-slate-500 sm:text-center leading-snug px-1">
        <span title={absTime(meta.canceledAt)}>Request canceled {canceled}</span>
      </div>
    );
  }
  return null;
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center">
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value >= i + 1;
        const half = !filled && value >= i + 0.5;
        return (
          <Star
            key={i}
            className={`w-3 h-3 ${filled ? "fill-yellow-400 text-yellow-400" : half ? "fill-yellow-400/50 text-yellow-400/60" : "text-slate-600"}`}
          />
        );
      })}
    </div>
  );
}

function TabFilters({
  tab,
  q,
  sort,
  onChangeQ,
  onChangeSort,
}: {
  tab: Tab;
  q: string;
  sort: ProfileSortKey;
  onChangeQ: (next: string) => void;
  onChangeSort: (next: ProfileSortKey) => void;
}) {
  const [draft, setDraft] = useState(q);
  // Keep the local input in sync when the URL changes externally (e.g. tab switch).
  useEffect(() => {
    setDraft(q);
  }, [q, tab]);
  // Debounce URL writes so every keystroke doesn't hit the server.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (draft.trim() !== q) onChangeQ(draft.trim());
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const options = SORT_OPTIONS_BY_TAB[tab];

  return (
    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative flex-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER[tab]}
          className="w-full bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
          aria-label={SEARCH_PLACEHOLDER[tab]}
        />
        {draft && (
          <button
            type="button"
            onClick={() => setDraft("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Sort</span>
        <select
          value={sort}
          onChange={(e) => onChangeSort(e.target.value as ProfileSortKey)}
          className="bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type StateAction = { label: string; onClick: () => void };

function EmptyState({
  title,
  hint,
  primary,
  secondary,
}: {
  title: string;
  hint?: string;
  primary?: StateAction;
  secondary?: StateAction;
}) {
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-8 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="text-sm text-slate-200 font-semibold">{title}</div>
      {hint && <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>}
      {(primary || secondary) && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {primary && (
            <button
              onClick={primary.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
            >
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              onClick={secondary.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs transition-colors"
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorState({
  label,
  hint,
  onRetry,
}: {
  label: string;
  hint?: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-[#1E1E24] border border-red-500/30 rounded-xl p-6 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="text-sm text-red-200 font-semibold">{label}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="mt-4 flex items-center justify-center">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    </div>
  );
}


function TabSkeleton({ variant }: { variant: Tab }) {
  const rows = 3;
  if (variant === "groups" || variant === "marketplace") {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#1E1E24] border border-white/10 rounded-xl p-4 animate-pulse">
            <div className="h-10 w-10 rounded-lg bg-white/5 mb-3" />
            <div className="h-3 w-2/3 bg-white/5 rounded mb-2" />
            <div className="h-2.5 w-1/2 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 animate-pulse">
          <div className="h-2.5 w-24 bg-white/5 rounded mb-3" />
          <div className="h-3 w-11/12 bg-white/5 rounded mb-2" />
          <div className="h-3 w-8/12 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  );
}

function emptyContentFor(
  tab: Tab,
  name: string,
  q: string,
  onClearSearch: () => void,
): {
  title: string;
  hint?: string;
  primary?: StateAction;
  secondary?: StateAction;
} {
  if (q && q.trim().length > 0) {
    return {
      title: `No ${tabNoun(tab)} match “${q.trim()}”.`,
      hint: "Try a different keyword or clear the search to see everything.",
      primary: { label: "Clear search", onClick: onClearSearch },
    };
  }
  switch (tab) {
    case "posts":
      return {
        title: `${name} hasn't posted yet`,
        hint: "New posts from this creator will show up here.",
      };
    case "groups":
      return {
        title: `${name} hasn't joined any circles`,
        hint: "Once they join a peer circle it will appear on this tab.",
      };
    case "marketplace":
      return {
        title: `${name} has no listings yet`,
        hint: "Products and services offered by this creator will land here.",
      };
    case "posted":
      return {
        title: "No open bounties",
        hint: "Active bounties this creator has posted will show up here.",
      };
    case "solved":
      return {
        title: "No solved bounties yet",
        hint: "Completed bounties with delivered proof will appear on this tab.",
      };
  }
}



function tabNoun(tab: Tab): string {
  switch (tab) {
    case "posts": return "posts";
    case "groups": return "groups";
    case "marketplace": return "listings";
    case "posted": return "bounties";
    case "solved": return "solved bounties";
  }
}

