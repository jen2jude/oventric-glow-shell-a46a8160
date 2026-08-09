import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfileEcosystem } from "@/lib/ecosystem/useProfileEcosystem";

import {
  getCircleStatus,
  sendCircleRequest,
  cancelCircleRequest,
  type CircleStatus,
} from "@/lib/circles.functions";
import {
  getLiveProfileTab,
  getLiveReputation,
  getProfileByIdOrSlug,
  getProfileSocialCounts,
  updateMyProfile,
  type LiveReputation,
  type ProfileSocialCounts,
  type RealProfileView,
  type ProfileTabPage,
  type ProfileSortKey,
} from "@/lib/profiles.functions";
import type {
  ProfilePost,
  ProfileGroup,
  ProfileListing,
  ProfileBounty,
  ProfileArticle,
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
  Images,
  Pencil,
  Globe,
  Twitter,
  Instagram,
  Linkedin,
  Github,
  Youtube,
  FileText,
} from "lucide-react";

/** Renders the matching brand glyph for a social-link key. */
function SocialIcon({ kind }: { kind: string }) {
  const cls = "w-4 h-4";
  if (kind === "x") return <Twitter className={cls} />;
  if (kind === "instagram") return <Instagram className={cls} />;
  if (kind === "linkedin") return <Linkedin className={cls} />;
  if (kind === "github") return <Github className={cls} />;
  if (kind === "youtube") return <Youtube className={cls} />;
  return <Globe className={cls} />;
}

import { listUserPhotos, type UserPhoto } from "@/lib/posts.functions";
import { getDashboardOverview, type DashboardOverview } from "@/lib/dashboard.functions";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";
import { PhotoBatches } from "@/components/oventric/PhotoBatches";
import { ProfileWall } from "@/components/oventric/ProfileWall";
import { Header } from "@/components/oventric/Header";
import { SiteNavbar } from "@/components/oventric/desktop/SiteNavbar";

import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import {
  getProfile,
  computeStarBreakdown,
  getCircleMembersPreview,
} from "@/lib/profiles/mockProfiles";
import { ReportModal } from "@/components/oventric/ReportModal";
import { EditProfileModal } from "@/components/oventric/EditProfileModal";
import { CircleRequestsDrawer } from "@/components/oventric/CircleRequestsDrawer";
import { FollowRequestsDrawer } from "@/components/oventric/FollowRequestsDrawer";
import { ProfileMessageModal } from "@/components/oventric/messaging/ProfileMessageModal";
import { EarningsBreakdown } from "@/components/oventric/profile/EarningsBreakdown";
import {
  RelationshipsSection,
  type RelationshipTab,
} from "@/components/oventric/RelationshipsSection";
import { useOnlineUsers } from "@/hooks/use-presence";
import { FollowButton } from "@/components/oventric/FollowButton";
import { JoinCirclePickerModal } from "@/components/oventric/JoinCirclePickerModal";
import { useIsAppShell } from "@/hooks/use-launch-context";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

const profileSearchSchema = z.object({
  tab: fallback(z.string(), "groups").default("groups"),
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
      {
        name: "description",
        content: `Profile, listings, and bounties for ${params.id} on Oventric.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type Tab =
  | "posts"
  | "groups"
  | "marketplace"
  | "services"
  | "courses"
  | "posted"
  | "solved"
  | "blog";
const TAB_KEYS: Tab[] = [
  "posts",
  "groups",
  "marketplace",
  "services",
  "courses",
  "posted",
  "solved",
  "blog",
];
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
  services: [
    { value: "newest", label: "Newest" },
    { value: "price_low", label: "Price: low to high" },
    { value: "price_high", label: "Price: high to low" },
    { value: "alpha", label: "A – Z" },
  ],
  courses: [
    { value: "newest", label: "Newest" },
    { value: "price_low", label: "Price: low to high" },
    { value: "price_high", label: "Price: high to low" },
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
  blog: [
    { value: "newest", label: "Newest" },
    { value: "most_liked", label: "Most reactions" },
    { value: "most_commented", label: "Most commented" },
    { value: "alpha", label: "A – Z" },
  ],
};
const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  posts: "Search posts…",
  groups: "Search groups…",
  marketplace: "Search listings…",
  services: "Search services…",
  courses: "Search courses…",

  posted: "Search bounties…",
  solved: "Search solved bounties…",
  blog: "Search articles…",
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
  const [photosMode, setPhotosMode] = useState(false);
  const [relTab, setRelTab] = useState<RelationshipTab>("followers");
  const onlineUsers = useOnlineUsers();
  const openRelationships = (which: RelationshipTab) => {
    setRelTab(which);
    requestAnimationFrame(() => {
      const el = document.getElementById("relationships");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLButtonElement>(`#rel-tab-${which}`)?.focus({ preventScroll: true });
    });
  };

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
  const [editProfileOpen, setEditProfileOpen] = useState(false);
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
    services: { ...emptyTabState },
    courses: { ...emptyTabState },

    posted: { ...emptyTabState },
    solved: { ...emptyTabState },
    blog: { ...emptyTabState },
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
  const isViewedUserOnline = !!realProfile?.userId && onlineUsers.has(realProfile.userId);
  const [realProfileLoaded, setRealProfileLoaded] = useState(false);
  const [liveRep, setLiveRep] = useState<LiveReputation | null>(null);
  const [socialCounts, setSocialCounts] = useState<ProfileSocialCounts | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
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
  const reloadSocialCounts = useCallback(() => {
    fetchSocialCounts({ data: { idOrSlug: id } })
      .then((c) => setSocialCounts(c))
      .catch(() => {});
  }, [fetchSocialCounts, id]);

  // ------- Avatar & cover image upload (own profile only) -------
  const updateProfileFn = useServerFn(updateMyProfile);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const reloadRealProfile = useCallback(async () => {
    try {
      const p = await fetchRealProfile({ data: { idOrSlug: id } });
      setRealProfile(p.profile);
    } catch (e) {
      console.error("[profile] reload after upload failed", e);
    }
  }, [fetchRealProfile, id]);
  const handleImagePicked = useCallback(
    async (kind: "avatar" | "cover", file: File | null | undefined) => {
      if (!file || !meId) return;
      if (!file.type.startsWith("image/")) {
        alert("Please choose an image file.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("Image is too large (max 8MB).");
        return;
      }
      const bucket = kind === "avatar" ? "avatars" : "profile-covers";
      const ext =
        (file.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 6) || "jpg";
      const path = `${meId}/${crypto.randomUUID()}.${ext}`;
      setUploading(kind);
      try {
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (upErr) throw upErr;
        await updateProfileFn({
          data: kind === "avatar" ? { avatarPath: path } : { coverPath: path },
        });
        await reloadRealProfile();
        try {
          window.dispatchEvent(
            new CustomEvent("oventric:profile-updated", { detail: { userId: meId } }),
          );
        } catch {
          /* noop */
        }
      } catch (e) {
        console.error("[profile] upload failed", e);
        alert(`Upload failed: ${e instanceof Error ? e.message : "Please try again."}`);
      } finally {
        setUploading(null);
      }
    },
    [meId, updateProfileFn, reloadRealProfile],
  );

  // Cross-component sync: whenever profile is updated elsewhere (Settings modal,
  // KYC edit, avatar change in Header, etc.), refetch so this page reflects it.
  useEffect(() => {
    const onUpdated = () => {
      void reloadRealProfile();
    };
    window.addEventListener("oventric:profile-updated", onUpdated);
    return () => window.removeEventListener("oventric:profile-updated", onUpdated);
  }, [reloadRealProfile]);

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
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : (socialCounts?.userId ?? null));
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
  // Adaptive ecosystem sections: a person's profile only shows the surfaces
  // they actually use (shop, services, courses, communities…).
  const { sections: ecosystemSections } = useProfileEcosystem(id, isOwnProfile);


  const fetchOverview = useServerFn(getDashboardOverview);
  useEffect(() => {
    if (!isOwnProfile) {
      setOverview(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await fetchOverview();
        if (alive) setOverview(res);
      } catch {
        if (alive) setOverview(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOwnProfile, fetchOverview]);

  const {
    containerRef: mainRef,
    getScrollY,
    setScrollY,
    pinAcrossChange,
    restore: restoreScroll,
    isRestored,
    markRestored,
  } = useScrollRestoration(tab);

  // Fetch a specific page (1-indexed). Returns the fetched response.
  const fetchOne = useCallback(
    async (
      which: Tab,
      pageNum: number,
      reset: boolean,
      filters: { q: string; sort: ProfileSortKey },
    ) => {
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

  // Scroll read/write is provided by useScrollRestoration above.

  // Load next page for a tab (used by "Load more"). Syncs URL.
  const loadMore = useCallback(async () => {
    const current = tabData[tab];
    if (current.loading || !current.hasMore) return;
    setTabData((s) => ({ ...s, [tab]: { ...s[tab], loading: true, error: null } }));
    const nextPage = (current.page || 0) + 1;
    try {
      await fetchOne(tab, nextPage, false, { q, sort });
      const y = getScrollY();
      navigate({
        to: "/profile/$id",
        params: { id },
        search: (prev: Record<string, unknown>) => ({ ...prev, tab, pages: nextPage, y }),
        replace: true,
        resetScroll: false,
      });
    } catch (e) {
      console.error(e);
      setTabData((s) => ({
        ...s,
        [tab]: { ...s[tab], loading: false, error: "Couldn't load. Try again." },
      }));
    }
  }, [tab, tabData, fetchOne, navigate, id, q, sort, getScrollY]);

  // Change tabs — preserve current scroll position, don't jump to top.
  const changeTab = useCallback(
    (next: Tab) => {
      const currentY = getScrollY();
      pinAcrossChange(currentY);
      if (next === tab) {
        requestAnimationFrame(() => restoreScroll(currentY));
        return;
      }
      const nextSort = SORT_OPTIONS_BY_TAB[next].some((o) => o.value === sort) ? sort : "newest";
      navigate({
        to: "/profile/$id",
        params: { id },
        search: { tab: next, pages: 1, y: currentY, q, sort: nextSort },
        replace: true,
        resetScroll: false,
      });
    },
    [tab, navigate, id, getScrollY, pinAcrossChange, restoreScroll, q, sort],
  );

  // Retry a failed tab: clear its cache so the load effect refetches up to
  // the current desiredPages (preserving pagination). Also reset scroll.
  const retryTab = useCallback(
    (which: Tab) => {
      markRestored(true); // don't try to restore old scroll
      setTabData((s) => ({ ...s, [which]: { ...emptyTabState } }));
      navigate({
        to: "/profile/$id",
        params: { id },
        search: (prev: Record<string, unknown>) => ({ ...prev, tab: which, y: 0 }),
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
        // Restore scroll after content is on the page. Prefer the tab-switch
        // target (in-page tab change) over the URL-derived restoreY.
        requestAnimationFrame(() => {
          if (!isRestored()) {
            restoreScroll(restoreY);
          }
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
    markRestored(false);
    setTabData({
      posts: { ...emptyTabState },
      groups: { ...emptyTabState },
      marketplace: { ...emptyTabState },
      services: { ...emptyTabState },
      courses: { ...emptyTabState },

      posted: { ...emptyTabState },
      solved: { ...emptyTabState },
      blog: { ...emptyTabState },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // When search query or sort changes, invalidate the current tab so it
  // reloads with the new filters. Do not run this on tab switches: clearing
  // the newly active tab briefly shrinks the page and mobile browsers clamp
  // the scroll position upward before the new content renders.
  useEffect(() => {
    if (isRestored()) markRestored(true); // don't cancel a pending tab-switch restore
    setTabData((s) => ({ ...s, [tab]: { ...emptyTabState } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]);

  // Persist scroll position into the URL (throttled) so reloads restore it.
  useEffect(() => {
    const el = mainRef.current;
    const usesMain = !!(el && el.scrollHeight > el.clientHeight + 1);
    const target: HTMLElement | Window = usesMain ? (el as HTMLElement) : window;
    let raf = 0;
    let lastWritten = restoreY;
    const readY = () => (usesMain ? (el as HTMLElement).scrollTop : window.scrollY);
    const onScroll = () => {
      if (!isRestored()) return;
      if (raf) return;
      raf = window.setTimeout(() => {
        raf = 0;
        const y = Math.round(readY());
        if (Math.abs(y - lastWritten) < 40) return;
        lastWritten = y;
        navigate({
          to: "/profile/$id",
          params: { id },
          search: (prev: Record<string, unknown>) => ({ ...prev, y }),
          replace: true,
          resetScroll: false,
        });
      }, 200) as unknown as number;
    };
    target.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    return () => {
      target.removeEventListener("scroll", onScroll as EventListener);
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
      ? identityPending
        ? "Loading profile…"
        : "Profile unavailable"
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
  const displayBio = hasRealProfile ? (realProfile!.bio ?? "") : isUuidId ? "" : profile.bio;
  const displayRole = hasRealProfile
    ? realProfile!.username
      ? `@${realProfile!.username}`
      : "Member"
    : isUuidId
      ? ""
      : profile.role;
  const displayJoined = hasRealProfile
    ? new Date(realProfile!.joined).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : isUuidId
      ? "—"
      : profile.joined;
  const displayAvatar = realProfile?.avatarUrl ?? null;
  const displayTierLabel = hasRealProfile
    ? realProfile!.verificationTier === "TIER_0"
      ? "Unverified"
      : `${realProfile!.verificationTier.replace("_", " ")} Verified`
    : isUuidId
      ? "Unverified"
      : "Verified";
  const displayStars =
    liveRep?.stars ?? realProfile?.reputationStars ?? (isUuidId ? 0 : starBreakdown.stars);

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
          setCircleMeta((m) => ({
            sentAt: m.sentAt,
            acceptedAt: null,
            canceledAt: res.canceledAt,
          }));
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
    const refresh = window.setInterval(() => {
      refreshMarketplace();
    }, 15000);
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
    <div className="profile-render-safe relative min-h-screen overflow-x-hidden bg-[#121214] md:bg-slate-50 text-slate-200 md:text-slate-700 md:h-screen md:overflow-hidden">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50  hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50  hidden md:block" />

      <div className="flex min-h-screen flex-col md:h-full md:min-h-0">
        <Header forceSiteNavbar={!useIsAppShell()} />
        <main ref={mainRef} className="flex-1 min-w-0 pb-20 md:overflow-y-auto md:pb-0">
          <div className="max-w-3xl mx-auto w-full px-4 py-6">
            <div className="profile-standard-actions flex items-center justify-between gap-3 mb-4">
              <button
                onClick={() => navigate({ to: "/" })}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 md:text-slate-500 hover:text-emerald-400 md:text-emerald-600"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to feed
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 hover:border-emerald-500/40 md:hover:border-emerald-300 text-xs font-semibold text-slate-200 md:text-slate-700 hover:text-white md:hover:text-slate-900 transition-colors"
                  aria-label="Copy profile link"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 md:text-emerald-600" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 text-slate-400 md:text-slate-500" />
                  )}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                {isOwnProfile && (
                  <button
                    onClick={() => setFollowRequestsOpen(true)}
                    className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 hover:border-sky-500/40 text-xs font-semibold text-slate-200 md:text-slate-700 hover:text-white md:hover:text-slate-900 transition-colors"
                    aria-label={`Open follow requests${pendingFollowReqCount > 0 ? ` (${pendingFollowReqCount} pending)` : ""}`}
                  >
                    <UserPlus className="w-3.5 h-3.5 text-sky-300 md:text-sky-700" />
                    Follow Requests
                    {pendingFollowReqCount > 0 && (
                      <span
                        className=" absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center"
                        aria-hidden
                      >
                        {pendingFollowReqCount > 9 ? "9+" : pendingFollowReqCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Hero — the whole mobile profile surface is intentionally plain:
                 no animated gradients, filters, backdrop blur, blend modes,
                 compositor promotion, or clipped gradient layers. Those effects
                 were the source of Android/Chrome static-noise corruption on
                 Infinix and Redmi devices during pull-to-refresh / reload. */}
            {/* Hidden file inputs for avatar / cover uploads (own profile). */}
            {isOwnProfile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                    overflow: "hidden",
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    handleImagePicked("avatar", f);
                    if (e.target) e.target.value = "";
                  }}
                />
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none",
                    overflow: "hidden",
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    handleImagePicked("cover", f);
                    if (e.target) e.target.value = "";
                  }}
                />
              </>
            )}

            <section
              data-testid="profile-banner"
              className="profile-card-safe profile-standard-header mb-6"
            >
              {/* Cover image (top banner) */}
              <div className="profile-cover-safe relative h-36 sm:h-56 rounded-2xl border border-white/10 md:border-slate-200 bg-[#18181d] md:bg-slate-100 overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]">
                {realProfile?.coverUrl ? (
                  <ResponsiveImage
                    src={realProfile.coverUrl}
                    alt={`${displayName} cover`}
                    sizes="(min-width: 768px) 768px, 100vw"
                    className="block h-full w-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500/25 via-cyan-500/10 to-fuchsia-500/25" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#121214] via-[#121214]/50 to-transparent" />
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploading === "cover"}
                    aria-label="Change cover image"
                    className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/70 border border-white/20 text-white text-xs font-semibold"
                  >
                    {uploading === "cover" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {uploading === "cover"
                        ? "Uploading…"
                        : realProfile?.coverUrl
                          ? "Change cover"
                          : "Add cover"}
                    </span>
                  </button>
                )}
              </div>

              {/* Centered identity — avatar overlaps cover from the top */}
              <div className="-mt-14 sm:-mt-16 flex flex-col items-center px-4">
                <div className="relative">
                  <div className="profile-avatar-safe w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-500 ring-4 ring-[#121214] shadow-[0_0_0_1px_rgba(96, 165, 250,0.45),0_18px_40px_-18px_rgba(59, 130, 246,0.7)] flex items-center justify-center text-black text-3xl font-black overflow-hidden">
                    {displayAvatar ? (
                      <ResponsiveImage
                        src={displayAvatar}
                        alt={`${displayName} avatar`}
                        sizes="128px"
                        className="block w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      displayInitials
                    )}
                  </div>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploading === "avatar"}
                      aria-label="Change profile picture"
                      className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-[#121214] flex items-center justify-center shadow-lg"
                    >
                      {uploading === "avatar" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" strokeWidth={2.4} />
                      )}
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
                  <h1 className="text-white md:text-slate-900 text-2xl sm:text-3xl font-black text-center leading-tight">
                    {displayName}
                  </h1>
                  <ShieldCheck
                    className="w-5 h-5 text-emerald-400 md:text-emerald-600"
                    aria-label={displayTierLabel}
                  />
                </div>

                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  {realProfile?.username && (
                    <span className="text-sm font-semibold text-slate-400 md:text-slate-500">
                      @{realProfile.username}
                    </span>
                  )}
                  {realProfile?.userId && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isViewedUserOnline
                          ? "border-emerald-400/40 bg-emerald-500/10 md:bg-emerald-50 text-emerald-300 md:text-emerald-700"
                          : "border-white/15 md:border-slate-300 bg-white/5 md:bg-slate-100 text-slate-400 md:text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${isViewedUserOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
                        aria-hidden
                      />
                      {isViewedUserOnline ? "Online now" : "Offline"}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 md:text-emerald-700">
                    <ShieldCheck className="w-3 h-3" /> {displayTierLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 md:border-slate-300 bg-white/5 md:bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 md:text-slate-600">
                    <Star className="w-3 h-3 text-amber-300 md:text-amber-600" />{" "}
                    {displayStars.toFixed(1)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/15 md:border-slate-300 bg-white/5 md:bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
                    Joined {displayJoined}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => openRelationships("followers")}
                    aria-controls="relationships"
                    className="rounded text-slate-300 md:text-slate-600 hover:text-emerald-300 md:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  >
                    <span className="font-bold text-white md:text-slate-900">
                      {(socialCounts?.followers ?? 0).toLocaleString()}
                    </span>{" "}
                    <span className="text-slate-500 md:text-slate-500">followers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRelationships("following")}
                    aria-controls="relationships"
                    className="rounded text-slate-300 md:text-slate-600 hover:text-emerald-300 md:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  >
                    <span className="font-bold text-white md:text-slate-900">
                      {(socialCounts?.following ?? 0).toLocaleString()}
                    </span>{" "}
                    <span className="text-slate-500 md:text-slate-500">following</span>
                  </button>
                  <span className="text-slate-300 md:text-slate-600">
                    <span className="font-bold text-white md:text-slate-900">
                      {(socialCounts?.circleMembers ?? 0).toLocaleString()}
                    </span>{" "}
                    <span className="text-slate-500 md:text-slate-500">in circle</span>
                  </span>
                </div>

                {/* Key stats */}
                <div className="mt-4 grid w-full max-w-md grid-cols-3 gap-2">
                  <HeaderStat
                    icon={<Sparkles className="w-4 h-4 text-cyan-300" />}
                    label="Posts"
                    value={liveRep ? liveRep.metrics.postsTotal.toLocaleString() : "…"}
                  />
                  <HeaderStat
                    icon={<Target className="w-4 h-4 text-emerald-300 md:text-emerald-700" />}
                    label="Bounties"
                    value={liveRep ? liveRep.metrics.bountiesSolved.toLocaleString() : "…"}
                  />
                  <HeaderStat
                    icon={<Award className="w-4 h-4 text-amber-300 md:text-amber-600" />}
                    label="Earnings"
                    value={
                      isOwnProfile
                        ? overview
                          ? `${overview.bounties.earnedCurrency} ${overview.bounties.earned.toLocaleString()}`
                          : "…"
                        : "Private"
                    }
                    muted={!isOwnProfile}
                  />
                </div>

                {displayBio && (
                  <p className="profile-mid-safe text-sm text-slate-300 md:text-slate-600 mt-3 leading-relaxed text-center max-w-md">
                    {displayBio}
                  </p>
                )}

                {realProfile?.skills && realProfile.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 max-w-md">
                    {realProfile.skills.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 md:text-emerald-700 border border-emerald-500/30"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {realProfile?.socialLinks && Object.keys(realProfile.socialLinks).length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {Object.entries(realProfile.socialLinks).map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        aria-label={key}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/15 md:border-slate-300 bg-white/5 md:bg-slate-100 text-slate-300 md:text-slate-600 hover:text-emerald-300 md:text-emerald-700 hover:border-emerald-400/50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        <SocialIcon kind={key} />
                      </a>
                    ))}
                  </div>
                )}

                {!isOwnProfile && !identityMissing && realProfile?.userId && (
                  <div className="mt-4 w-full max-w-md">
                    {/* Primary duo: follow + premium message CTA */}
                    <div className="flex flex-wrap items-start justify-center gap-2">
                      <FollowButton
                        targetId={realProfile.userId}
                        className="flex-1 min-w-[140px]"
                      />
                      <button
                        onClick={handleChat}
                        aria-label={`Message ${displayName}`}
                        className="group relative flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-4 py-2 text-sm font-black text-black shadow-sm transition-transform hover:-translate-y-px active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
                      >
                        {/* Sheen sweep */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/40 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100"
                        />
                        <MessageCircle className="relative w-4 h-4" strokeWidth={2.6} />
                        <span className="relative">Message</span>
                        <span
                          aria-hidden
                          className={`relative h-1.5 w-1.5 rounded-full ${
                            isViewedUserOnline ? "bg-black/70 animate-pulse" : "bg-black/25"
                          }`}
                        />
                      </button>
                    </div>
                    <p className="mt-1.5 text-center text-[11px] text-slate-500 md:text-slate-500">
                      {isViewedUserOnline
                        ? "Online now · usually replies in minutes"
                        : "Send a direct message — replies land in your inbox"}
                    </p>

                    {/* Secondary actions */}
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => setJoinCircleOpen(true)}
                        className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/40 md:border-emerald-300 bg-emerald-500/10 md:bg-emerald-50 text-emerald-300 md:text-emerald-700 hover:bg-emerald-500/20 md:hover:bg-emerald-100 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                        aria-label="Request to join one of this user's circles"
                      >
                        <Users className="w-4 h-4" /> Join Circle
                      </button>
                      <button
                        onClick={() => setReportOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 md:border-slate-200 text-slate-400 md:text-slate-500 hover:text-red-400 hover:bg-white/5 md:bg-slate-100 md:hover:bg-slate-100 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                      >
                        <Flag className="w-3.5 h-3.5" /> Report
                      </button>
                    </div>
                  </div>
                )}
                {isOwnProfile && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => setEditProfileOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={2.5} /> Edit profile
                    </button>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/40 md:border-emerald-300 bg-emerald-500/10 md:bg-emerald-50 text-emerald-300 md:text-emerald-700 text-xs font-semibold">
                      This is your profile
                    </span>
                    <button
                      onClick={() => navigate({ to: "/" })}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 md:border-slate-300 text-white md:text-slate-900 hover:bg-white/5 md:bg-slate-100 md:hover:bg-slate-100 text-sm font-semibold"
                    >
                      Back to feed
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Reputation block */}
            <div
              data-testid="profile-reputation"
              className="profile-reputation-safe profile-card-safe mt-5 p-4 sm:p-6 rounded-xl border border-white/10 md:border-slate-200 bg-[#1E1E24] md:bg-white md:shadow-sm"
            >
              <div className="sm:hidden rounded-lg border border-[#2A2A30] md:border-slate-200 bg-[#17171C] md:bg-white md:shadow-sm">
                <MobileRepLine
                  icon={<Star className="w-4 h-4 text-white" />}
                  label="Star Rating"
                  value={`${displayStars.toFixed(1)} / 5`}
                />
                <MobileRepLine
                  icon={<Target className="w-4 h-4 text-white" />}
                  label="Bounties Solved"
                  value={liveRep ? liveRep.metrics.bountiesSolved : "…"}
                />
                <MobileRepLine
                  icon={<Award className="w-4 h-4 text-white" />}
                  label="Product Rating"
                  value={
                    liveRep
                      ? liveRep.metrics.productReviewCount > 0
                        ? liveRep.metrics.avgProductRating.toFixed(1)
                        : "—"
                      : "…"
                  }
                />
                <MobileRepLine
                  icon={<ShoppingBag className="w-4 h-4 text-white" />}
                  label="Listings"
                  value={liveRep ? liveRep.metrics.productsListed : "…"}
                />
                <MobileRepLine
                  icon={<ShieldCheck className="w-4 h-4 text-white" />}
                  label="Posts (30d)"
                  value={liveRep ? liveRep.metrics.postsLast30d : "…"}
                  last
                />
              </div>

              <div className="hidden sm:grid sm:grid-cols-5 gap-3">
                <RepStat
                  icon={<Star className="w-4 h-4 text-white" />}
                  label="Star Rating"
                  value={
                    <div className="flex items-center gap-1">
                      <span className="text-white md:text-slate-900 font-black">
                        {displayStars.toFixed(1)}
                      </span>
                      <StarRow value={displayStars} />
                    </div>
                  }
                />
                <RepStat
                  icon={<Target className="w-4 h-4 text-white" />}
                  label="Bounties Solved"
                  value={
                    <span className="text-white md:text-slate-900 font-black">
                      {liveRep ? liveRep.metrics.bountiesSolved : "…"}
                    </span>
                  }
                />
                <RepStat
                  icon={<Award className="w-4 h-4 text-white" />}
                  label="Product Rating"
                  value={
                    <span className="text-white md:text-slate-900 font-black">
                      {liveRep
                        ? liveRep.metrics.productReviewCount > 0
                          ? liveRep.metrics.avgProductRating.toFixed(1)
                          : "—"
                        : "…"}
                    </span>
                  }
                />
                <RepStat
                  icon={<ShoppingBag className="w-4 h-4 text-white" />}
                  label="Listings"
                  value={
                    <span className="text-white md:text-slate-900 font-black">
                      {liveRep ? liveRep.metrics.productsListed : "…"}
                    </span>
                  }
                />
                <RepStat
                  icon={<ShieldCheck className="w-4 h-4 text-white" />}
                  label="Posts (30d)"
                  value={
                    <span className="text-white md:text-slate-900 font-black">
                      {liveRep ? liveRep.metrics.postsLast30d : "…"}
                    </span>
                  }
                />
              </div>
            </div>

            {/* Member details: country, address & birthday — centred */}
            <div className="profile-card-safe mt-4 rounded-lg border border-white/5  md:border-slate-200 bg-[#17171C] md:bg-white md:shadow-sm p-4 text-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 md:text-slate-600 mb-3">
                Member details
              </h3>
              <dl className="mx-auto max-w-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm justify-items-center">
                <div className="text-center">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500 md:text-slate-500">
                    Country
                  </dt>
                  <dd className="mt-0.5 text-white md:text-slate-900 font-semibold">
                    {realProfile?.country?.trim() || (
                      <span className="text-slate-500 md:text-slate-500 font-normal">
                        Not provided
                      </span>
                    )}
                  </dd>
                </div>
                <div className="text-center">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500 md:text-slate-500">
                    Address
                  </dt>
                  <dd className="mt-0.5 text-white md:text-slate-900 font-semibold break-words">
                    {realProfile?.address?.trim() ? (
                      realProfile.address
                    ) : isOwnProfile ? (
                      <span className="text-slate-500 md:text-slate-500 font-normal">Private</span>
                    ) : (
                      <span className="text-slate-500 md:text-slate-500 font-normal">
                        Not shared
                      </span>
                    )}
                  </dd>
                </div>
                <div className="text-center">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500 md:text-slate-500">
                    Date of birth
                  </dt>
                  <dd className="mt-0.5 text-white md:text-slate-900 font-semibold">
                    {realProfile?.dateOfBirth ? (
                      new Date(realProfile.dateOfBirth).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    ) : isOwnProfile ? (
                      <span className="text-slate-500 md:text-slate-500 font-normal">Private</span>
                    ) : (
                      <span className="text-slate-500 md:text-slate-500 font-normal">
                        Not shared
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Tabs */}
            <nav
              data-testid="profile-tabs"
              className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/10 md:border-slate-200"
            >
              {ecosystemSections
                .filter((s): s is typeof s & { key: Tab } => isTab(s.key))
                .map((section) => {
                  const key = section.key;
                  const label = section.label;
                  const count = tabData[key].total ?? section.count;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      setPhotosMode(false);
                      changeTab(key);
                    }}
                    className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                      tab === key && !photosMode
                        ? "text-emerald-400 md:text-emerald-600 border-emerald-400"
                        : "text-slate-400 md:text-slate-500 border-transparent hover:text-white md:hover:text-slate-900"
                    }`}
                  >
                    {label}
                    <span className="text-xs text-slate-500 md:text-slate-500 ml-1">
                      ({count === null ? "…" : count})
                    </span>
                  </button>
                );
              })}
              <button
                key="photos"
                onClick={() => {
                  const currentY = getScrollY();
                  pinAcrossChange(currentY);
                  setPhotosMode(true);
                  requestAnimationFrame(() => restoreScroll(currentY));
                }}
                className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  photosMode
                    ? "text-emerald-400 md:text-emerald-600 border-emerald-400"
                    : "text-slate-400 md:text-slate-500 border-transparent hover:text-white md:hover:text-slate-900"
                }`}
              >
                Photos
              </button>
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
                  search: (prev: Record<string, unknown>) => ({
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
                  search: (prev: Record<string, unknown>) => ({
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
                <div className="inline-flex items-center gap-1.5 text-slate-400 md:text-slate-500">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      mpRefreshing ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"
                    }`}
                    aria-hidden
                  />
                  <span className="font-semibold text-emerald-300 md:text-emerald-700">
                    Live prices
                  </span>
                  <span className="text-slate-500 md:text-slate-500">
                    · Last updated {mpAgoLabel}
                  </span>
                </div>
                <button
                  onClick={refreshMarketplace}
                  disabled={mpRefreshing}
                  className="text-slate-400 md:text-slate-500 hover:text-emerald-400 md:text-emerald-600 disabled:opacity-50 font-semibold"
                  aria-label="Refresh marketplace prices"
                >
                  {mpRefreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            )}

            {/* Tab content */}
            <section data-testid="profile-tab-content" className="mt-5 space-y-3">
              {photosMode ? (
                <ProfilePhotosGallery slug={id} />
              ) : (
                (() => {
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
                    const empty = emptyContentFor(
                      tab,
                      profile.name,
                      q,
                      () => {
                        navigate({
                          to: "/profile/$id",
                          params: { id },
                          search: (prev: Record<string, unknown>) => ({
                            ...prev,
                            q: "",
                            pages: 1,
                            y: 0,
                          }),
                          replace: true,
                        });
                      },
                      () => {
                        navigate({ to: "/", search: { section: "Circles" } as never });
                      },
                    );
                    return <EmptyState {...empty} />;
                  }

                  return (
                    <>
                      {(() => {
                        // Uniform grid tiles across every tab. Tiles deep-link to the
                        // profile item detail route so the panel loads instantly with
                        // its own skeleton while the URL stays shareable.
                        type TileConfig = {
                          key: string;
                          kind: "post" | "group" | "listing" | "bounty" | "solved";
                          itemId: string;
                          blogSlug?: string;
                          academy?: boolean;

                          coverUrl?: string | null;
                          placeholderIcon: React.ReactNode;
                          badge?: { label: string; tone: "emerald" | "purple" | "sky" | "amber" };
                          title: string;
                          subtitle?: string;
                          priceLabel?: string;
                        };
                        let tiles: TileConfig[] = [];
                        if (tab === "posts") {
                          tiles = (st.items as ProfilePost[]).map((p) => ({
                            key: p.id,
                            kind: "post" as const,
                            itemId: p.id,
                            placeholderIcon: (
                              <MessageCircle className="w-8 h-8 text-emerald-300 md:text-emerald-700/70" />
                            ),
                            title: p.content,
                            subtitle: `${p.timeAgo} · ❤ ${p.likes} · 💬 ${p.comments}`,
                          }));
                        } else if (tab === "groups") {
                          tiles = (st.items as ProfileGroup[]).map((g) => ({
                            key: g.id,
                            kind: "group" as const,
                            itemId: g.id,
                            placeholderIcon: (
                              <Users className="w-8 h-8 text-emerald-300 md:text-emerald-700/70" />
                            ),
                            title: g.name,
                            subtitle: `${g.tag} · ${g.members.toLocaleString()} member${g.members === 1 ? "" : "s"}`,
                          }));
                        } else if (tab === "marketplace" || tab === "services") {
                          tiles = (st.items as ProfileListing[]).map((l) => ({
                            key: l.id,
                            kind: "listing" as const,
                            itemId: l.id,
                            coverUrl: l.coverUrl ?? null,
                            placeholderIcon: <ShoppingBag className="w-8 h-8 text-white/30" />,
                            badge: { label: l.category, tone: "emerald" as const },
                            title: l.title,
                            subtitle: tab === "services" ? "Service" : `${l.sales} sold`,
                            priceLabel: price(l.priceUsd),
                          }));
                        } else if (tab === "courses") {
                          tiles = (st.items as ProfileListing[]).map((l) => ({
                            key: l.id,
                            kind: "listing" as const,
                            itemId: l.id,
                            academy: true,
                            coverUrl: l.coverUrl ?? null,
                            placeholderIcon: (
                              <FileText className="w-8 h-8 text-sky-300 md:text-sky-700/70" />
                            ),
                            badge: { label: l.category, tone: "sky" as const },
                            title: l.title,
                            subtitle: "Course",
                            priceLabel: l.priceUsd > 0 ? price(l.priceUsd) : "Free",
                          }));

                        } else if (tab === "posted") {
                          tiles = (st.items as ProfileBounty[]).map((b) => ({
                            key: b.id,
                            kind: "bounty" as const,
                            itemId: b.id,
                            coverUrl: b.coverUrl ?? null,
                            placeholderIcon: (
                              <Target className="w-8 h-8 text-emerald-300 md:text-emerald-700/70" />
                            ),
                            badge: {
                              label: b.status === "open" ? "Awaiting solve" : "In progress",
                              tone: b.status === "open" ? ("emerald" as const) : ("amber" as const),
                            },
                            title: b.title,
                            subtitle: `${b.applicants ?? 0} applicant${(b.applicants ?? 0) === 1 ? "" : "s"}`,
                            priceLabel: price(b.amountUsd),
                          }));
                        } else if (tab === "blog") {
                          tiles = (st.items as ProfileArticle[]).map((a) => ({
                            key: a.id,
                            kind: "post" as const,
                            itemId: a.id,
                            blogSlug: a.slug,
                            coverUrl: a.coverUrl ?? null,
                            placeholderIcon: (
                              <FileText className="w-8 h-8 text-sky-300 md:text-sky-700/70" />
                            ),
                            badge: a.category
                              ? { label: a.category, tone: "sky" as const }
                              : undefined,
                            title: a.title,
                            subtitle: `${a.timeAgo} · ❤ ${a.reactions} · 💬 ${a.comments}`,
                          }));
                        } else if (tab === "solved") {
                          tiles = (st.items as ProfileBounty[]).map((b) => ({
                            key: b.id,
                            kind: "solved" as const,
                            itemId: b.id,
                            coverUrl: b.coverUrl ?? null,
                            placeholderIcon: <Award className="w-8 h-8 text-purple-300/70" />,
                            badge: { label: "Settled", tone: "purple" as const },
                            title: b.title,
                            subtitle: b.proof || undefined,
                            priceLabel: price(b.amountUsd),
                          }));
                        }

                        const toneRing: Record<string, string> = {
                          emerald:
                            "border-emerald-500/30 text-emerald-300 md:text-emerald-700 bg-emerald-500/10 md:bg-emerald-50",
                          purple: "border-purple-500/30 text-purple-300 bg-purple-500/10",
                          sky: "border-sky-500/30 text-sky-300 md:text-sky-700 bg-sky-500/10",
                          amber:
                            "border-amber-500/30 text-amber-300 md:text-amber-600 bg-amber-500/10",
                        };

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {tiles.map((t) => (
                              <Link
                                key={t.key}
                                {...(t.blogSlug
                                  ? ({ to: "/blog/$slug", params: { slug: t.blogSlug } } as any)
                                  : ({
                                      to: "/profile/$id/item/$kind/$itemId",
                                      params: { id: profile.id, kind: t.kind, itemId: t.itemId },
                                      search: itemSearch,
                                    } as any))}
                                className="group block bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-500/40 md:hover:border-emerald-300 transition-colors"
                              >
                                <div className="relative aspect-[4/3] bg-neutral-900 overflow-hidden">
                                  {t.coverUrl ? (
                                    <img
                                      src={t.coverUrl}
                                      alt={t.title}
                                      loading="lazy"
                                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                                      {t.placeholderIcon}
                                    </div>
                                  )}
                                  {t.badge && (
                                    <span
                                      className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                        toneRing[t.badge.tone]
                                      }`}
                                    >
                                      {t.badge.label}
                                    </span>
                                  )}
                                  {t.priceLabel && (
                                    <span className="absolute top-2 right-2 text-[11px] font-black px-2 py-0.5 rounded-full bg-black/70 text-white">
                                      {t.priceLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="p-3">
                                  <div className="text-white md:text-slate-900 font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                                    {t.title}
                                  </div>
                                  {t.subtitle && (
                                    <div className="mt-1 text-[11px] text-slate-500 md:text-slate-500 line-clamp-1">
                                      {t.subtitle}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Pagination footer */}
                      <div className="pt-2 flex items-center justify-center">
                        {st.hasMore ? (
                          <button
                            onClick={() => loadMore()}
                            disabled={st.loading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 md:border-slate-200 text-sm text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:bg-slate-100 md:hover:bg-slate-100 disabled:opacity-50"
                          >
                            {st.loading
                              ? "Loading…"
                              : `Load more (${(st.total ?? 0) - st.items.length} left)`}
                          </button>
                        ) : (
                          <div className="text-[11px] text-slate-500 md:text-slate-500">
                            You've reached the end · {st.items.length} of {st.total}
                          </div>
                        )}
                      </div>
                      {st.error && st.items.length > 0 && (
                        <div className="flex items-center justify-center gap-2 text-[11px] text-red-300">
                          <span>{st.error}</span>
                          <button
                            onClick={() => retryTab(tab)}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-400 md:text-emerald-600 hover:text-emerald-300 md:text-emerald-700"
                          >
                            <RefreshCw className="w-3 h-3" /> Try again
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </section>

            {realProfile?.userId && (
              <RelationshipsSection
                userId={realProfile.userId}
                name={displayName}
                viewerId={meId ?? null}
                tab={relTab}
                onTabChange={setRelTab}
                counts={{
                  followers: socialCounts?.followers ?? 0,
                  following: socialCounts?.following ?? 0,
                }}
              />
            )}

            <EarningsBreakdown isOwner={isOwnProfile} />

            {/* Member wall — followers can drop posts, owner is notified */}
            {realProfile?.userId && (
              <ProfileWall
                wallUserId={realProfile.userId}
                wallOwnerName={displayName}
                viewerId={meId ?? null}
              />
            )}
          </div>
        </main>
        {/* Mobile footer nav is rendered globally in __root.tsx */}
      </div>

      {realProfile?.userId && (
        <ProfileMessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={{
            userId: realProfile.userId,
            displayName,
            avatarUrl: realProfile.avatarUrl,
            slug: realProfile.slug,
          }}
        />
      )}
      <CircleRequestsDrawer open={requestsOpen} onClose={() => setRequestsOpen(false)} />
      <FollowRequestsDrawer
        open={followRequestsOpen}
        onClose={() => setFollowRequestsOpen(false)}
      />
      {isOwnProfile && realProfile && (
        <EditProfileModal
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          userId={realProfile.userId}
          initial={{
            displayName: realProfile.displayName,
            bio: realProfile.bio,
            avatarUrl: realProfile.avatarUrl,
            coverUrl: realProfile.coverUrl,
            socialLinks: realProfile.socialLinks,
            skills: realProfile.skills,
          }}
          onSaved={reloadRealProfile}
        />
      )}
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

function RepStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="profile-card-safe bg-[#17171C] md:bg-white md:shadow-sm border border-white/5  md:border-slate-200 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 md:text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function MobileRepLine({
  label,
  value,
  icon,
  last = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-12 items-center justify-between gap-3 px-3 py-2.5 ${last ? "" : "border-b border-[#2A2A30] md:border-slate-200"}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="shrink-0 inline-flex">{icon}</span> : null}
        <div className="min-w-0 text-xs font-semibold text-slate-300 md:text-slate-600">
          {label}
        </div>
      </div>
      <div className="shrink-0 text-sm font-black text-white md:text-slate-900">{value}</div>
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
      <div className="text-[11px] text-emerald-300 md:text-emerald-700/90 sm:text-center leading-snug px-1 space-y-0.5">
        {accepted && (
          <div>
            <span title={absTime(meta.acceptedAt)}>Accepted {accepted}</span>
          </div>
        )}
        {sent && (
          <div className="text-slate-500 md:text-slate-500">
            <span title={absTime(meta.sentAt)}>Request sent {sent}</span>
          </div>
        )}
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="text-[11px] text-slate-400 md:text-slate-500 sm:text-center leading-snug px-1 space-y-0.5">
        {sent && (
          <div>
            <span title={absTime(meta.sentAt)}>Sent {sent}</span>
          </div>
        )}
        <div className="text-slate-500 md:text-slate-500">
          Waiting on {firstName} to accept from their inbox.
        </div>
      </div>
    );
  }

  // status === "none"
  if (canceled) {
    return (
      <div className="text-[11px] text-slate-500 md:text-slate-500 sm:text-center leading-snug px-1">
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
          className="w-full bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-200 md:text-slate-700 placeholder:text-slate-500 md:text-slate-500 focus:outline-none focus:border-emerald-500/40 md:border-emerald-300"
          aria-label={SEARCH_PLACEHOLDER[tab]}
        />
        {draft && (
          <button
            type="button"
            onClick={() => setDraft("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 md:text-slate-500 hover:text-slate-200 md:text-slate-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 md:text-slate-500">
          Sort
        </span>
        <select
          value={sort}
          onChange={(e) => onChangeSort(e.target.value as ProfileSortKey)}
          className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-200 md:text-slate-700 focus:outline-none focus:border-emerald-500/40 md:border-emerald-300"
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

function ProfilePhotosGallery({ slug }: { slug: string }) {
  const fetchPhotos = useServerFn(listUserPhotos);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [filter, setFilter] = useState<"all" | "avatar" | "cover" | "post">("all");
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetchPhotos({ data: { slugOrId: slug } });
        if (!cancel) setPhotos(r.photos);
      } catch {
        if (!cancel) setPhotos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchPhotos, slug]);

  if (photos === null) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 md:text-slate-500" />
      </div>
    );
  }
  const filtered = filter === "all" ? photos : photos.filter((p) => p.source === filter);
  const chip = (v: typeof filter, label: string) => (
    <button
      key={v}
      onClick={() => setFilter(v)}
      className={`px-3 py-1 rounded-full text-xs border ${filter === v ? "bg-emerald-500/20 md:bg-emerald-100 border-emerald-500/40 md:border-emerald-300 text-emerald-300 md:text-emerald-700" : "border-white/10 md:border-slate-200 text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "All")}
        {chip("post", "Posts")}
        {chip("avatar", "Profile")}
        {chip("cover", "Cover")}
      </div>
      {filtered.length === 0 ? (
        <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl py-16 px-6 text-center">
          <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-500/10 md:bg-emerald-50 border border-emerald-500/30 text-emerald-300 md:text-emerald-700 flex items-center justify-center">
            <Images className="w-4 h-4" />
          </div>
          <div className="text-sm text-slate-200 md:text-slate-700 font-semibold">
            No photos yet
          </div>
          <p className="mt-1 text-xs text-slate-500 md:text-slate-500 max-w-sm mx-auto">
            Photos from posts, profile picture and cover image will show up here.
          </p>
        </div>
      ) : (
        <PhotoBatches photos={filtered} />
      )}
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
    <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-8 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-500/10 md:bg-emerald-50 border border-emerald-500/30 text-emerald-300 md:text-emerald-700 flex items-center justify-center">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="text-sm text-slate-200 md:text-slate-700 font-semibold">{title}</div>
      {hint && (
        <p className="mt-1 text-xs text-slate-500 md:text-slate-500 max-w-sm mx-auto">{hint}</p>
      )}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 md:border-slate-200 text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:bg-slate-100 md:hover:bg-slate-100 text-xs transition-colors"
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
    <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-red-500/30 rounded-xl p-6 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="text-sm text-red-200 font-semibold">{label}</div>
      {hint && <p className="mt-1 text-xs text-slate-500 md:text-slate-500">{hint}</p>}
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

function TabSkeleton({ variant: _variant }: { variant: Tab }) {
  // One shared tile skeleton so every tab loads with the same rhythm as the grid.
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#141418] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/3] bg-white/[0.04]" />
          <div className="p-3">
            <div className="h-3 w-11/12 bg-white/5 md:bg-slate-100 rounded mb-2" />
            <div className="h-3 w-7/12 bg-white/5 md:bg-slate-100 rounded mb-2" />
            <div className="h-2.5 w-1/2 bg-white/5 md:bg-slate-100 rounded" />
          </div>
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
  onJoinCircle: () => void,
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
        title: `${name} hasn't joined any circle yet`,
        hint: "Click below to explore circles and request to join.",
        primary: { label: "Click here to join a circle", onClick: onJoinCircle },
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
    case "blog":
      return {
        title: `${name} hasn't published any articles`,
        hint: "Published blog articles from this creator will appear here.",
      };
    case "services":
      return {
        title: `${name} offers no services yet`,
        hint: "Services this creator offers will appear here.",
      };
    case "courses":
      return {
        title: `${name} hasn't published a course`,
        hint: "Courses published by this creator will appear here.",
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
    case "posts":
      return "posts";
    case "groups":
      return "groups";
    case "marketplace":
      return "listings";
    case "services":
      return "services";
    case "courses":
      return "courses";
    case "posted":
      return "bounties";
    case "solved":
      return "solved bounties";
    case "blog":
      return "articles";
  }
}


function HeaderStat({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 md:border-slate-200 bg-white/[0.04] px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:text-slate-500">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`mt-1 truncate text-sm font-black ${muted ? "text-slate-500 md:text-slate-500" : "text-white md:text-slate-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
