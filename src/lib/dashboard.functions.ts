import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* -------------------------------------------------------------------------- */
/*  Overview snapshot                                                          */
/* -------------------------------------------------------------------------- */

type HomeCurrency = "USD" | "NGN" | "GHS";

function countryToHomeCurrency(country: string | null | undefined): HomeCurrency {
  const c = (country ?? "").toUpperCase();
  if (c === "NG") return "NGN";
  if (c === "GH") return "GHS";
  return "USD";
}

const FX_FALLBACK: Record<HomeCurrency, number> = { USD: 1, NGN: 1500, GHS: 14 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUsdRates(sb: any): Promise<Record<HomeCurrency, number>> {
  try {
    const { data } = await sb.from("platform_settings").select("fx_rates").maybeSingle();
    const r = (data?.fx_rates ?? null) as Record<string, number> | null;
    if (!r) return FX_FALLBACK;
    return {
      USD: 1,
      NGN: Number(r.NGN) > 0 ? Number(r.NGN) : FX_FALLBACK.NGN,
      GHS: Number(r.GHS) > 0 ? Number(r.GHS) : FX_FALLBACK.GHS,
    };
  } catch {
    return FX_FALLBACK;
  }
}

export interface DashboardOverview {
  homeCurrency: HomeCurrency;
  wallet: { currency: HomeCurrency; available: number; escrow: number } | null;
  purchases: { total: number; pending: number };
  contacts: number;
  listings: { total: number; pending: number; active: number; rejected: number };
  bounties: { posted: number; active: number; solved: number; earnedUSD: number; earned: number; earnedCurrency: HomeCurrency };
  courses: { enrolled: number; completed: number; published: number };
  social: { followers: number; following: number; circles: number };
  unread: { messages: number; notifications: number };
}

export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardOverview> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const [
      wallets,
      ordersRes,
      contactsRes,
      productsRes,
      bountiesPostedRes,
      bountyPayoutsRes,
      enrolledRes,
      publishedRes,
      followersRes,
      followingRes,
      circlesRes,
      unreadMsgRes,
      unreadNotifRes,
      profileRes,
      rates,
    ] = await Promise.all([
      sb.from("wallets").select("currency, available_balance, escrow_balance").eq("user_id", me),
      sb.from("orders").select("id, status", { count: "exact", head: false }).eq("buyer_id", me),
      sb.from("product_contacts").select("id", { count: "exact", head: true }).eq("user_id", me),
      sb.from("products").select("id, status").eq("seller_id", me),
      sb.from("bounties").select("id, status", { count: "exact", head: false }).eq("poster_id", me),
      sb.from("wallet_transactions").select("amount").eq("user_id", me).eq("type", "Gig Bounty Escrowed").eq("inflow", true).eq("status", "success"),
      sb.from("course_enrollments").select("id, completed_at").eq("user_id", me),
      sb.from("courses").select("id", { count: "exact", head: true }).eq("owner_id", me),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", me),
      sb.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", me),
      sb.from("circle_members").select("circle_id", { count: "exact", head: true }).eq("user_id", me),
      sb.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", me).is("read_at", null),
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me).is("read_at", null),
      (async () => {
        // Profiles has restricted grants for authenticated; use admin to read
        // the caller's own country so home-currency resolution is reliable.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return await supabaseAdmin.from("profiles").select("country").eq("user_id", me).maybeSingle();
        } catch {
          return { data: null } as { data: { country: string | null } | null };
        }
      })(),
      loadUsdRates(sb),
    ]);

    // Home currency comes from the user's country. Overview always reports
    // the wallet + bounty earnings in this currency only.
    const homeCurrency: HomeCurrency = countryToHomeCurrency(
      (profileRes?.data as { country?: string | null } | null)?.country ?? null,
    );


    const walletRows = (wallets.data ?? []) as Array<{ currency: string; available_balance: number; escrow_balance: number }>;
    const home = walletRows.find((w) => w.currency === homeCurrency) ?? null;

    const orderRows = (ordersRes.data ?? []) as Array<{ status: string }>;
    const productRows = (productsRes.data ?? []) as Array<{ status: string }>;
    const bountyRows = (bountiesPostedRes.data ?? []) as Array<{ status: string }>;
    const enrollRows = (enrolledRes.data ?? []) as Array<{ completed_at: string | null }>;
    const payoutRows = (bountyPayoutsRes.data ?? []) as Array<{ amount: number }>;

    const earnedUSD = payoutRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const earnedHome = earnedUSD * (rates[homeCurrency] ?? 1);

    return {
      homeCurrency,
      wallet: {
        currency: homeCurrency,
        available: Number(home?.available_balance ?? 0),
        escrow: Number(home?.escrow_balance ?? 0),
      },
      purchases: {
        total: orderRows.filter((o) => o.status === "paid").length,
        pending: orderRows.filter((o) => o.status === "pending").length,
      },
      contacts: contactsRes.count ?? 0,
      listings: {
        total: productRows.length,
        pending: productRows.filter((p) => p.status === "pending").length,
        active: productRows.filter((p) => p.status === "active").length,
        rejected: productRows.filter((p) => p.status === "rejected").length,
      },
      bounties: {
        posted: bountyRows.length,
        active: bountyRows.filter((b) => b.status === "active").length,
        solved: payoutRows.length,
        earnedUSD: Number(earnedUSD.toFixed(2)),
        earned: Number(earnedHome.toFixed(homeCurrency === "USD" ? 2 : 0)),
        earnedCurrency: homeCurrency,
      },
      courses: {
        enrolled: enrollRows.length,
        completed: enrollRows.filter((e) => e.completed_at).length,
        published: publishedRes.count ?? 0,
      },
      social: {
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
        circles: circlesRes.count ?? 0,
      },
      unread: {
        messages: unreadMsgRes.count ?? 0,
        notifications: unreadNotifRes.count ?? 0,
      },
    };
  });


/* -------------------------------------------------------------------------- */
/*  Bounties tab                                                               */
/* -------------------------------------------------------------------------- */

export interface DashboardBountyPosted {
  id: string;
  title: string;
  category: string;
  priceUSD: number;
  status: string;
  deadlineAt: string | null;
  createdAt: string;
}

export interface DashboardBountySolved {
  id: string;
  bountyId: string | null;
  title: string;
  payoutUSD: number;
  solvedAt: string;
}

export const listMyBounties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ posted: DashboardBountyPosted[]; solved: DashboardBountySolved[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const { data: posted, error: pErr } = await sb
      .from("bounties")
      .select("id, title, category, price_usd, status, deadline_at, created_at")
      .eq("poster_id", me)
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    // Solver history — audit_logs is admin-only under RLS, so read via admin
    // client scoped strictly to this authenticated user's solver_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: solvedLogs } = await admin
      .from("audit_logs")
      .select("target_id, meta, created_at")
      .eq("action", "bounty.payout")
      .filter("meta->>solver_id", "eq", me)
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = (solvedLogs ?? []) as Array<{ target_id: string | null; meta: Record<string, unknown>; created_at: string }>;
    const bountyIds = rows.map((r) => r.target_id).filter((x): x is string => !!x);
    let titles = new Map<string, string>();
    if (bountyIds.length) {
      const { data: bs } = await admin.from("bounties").select("id, title").in("id", bountyIds);
      titles = new Map(((bs ?? []) as Array<{ id: string; title: string }>).map((b) => [b.id, b.title]));
    }
    const solved: DashboardBountySolved[] = rows.map((r) => ({
      id: `${r.target_id ?? "solved"}-${r.created_at}`,
      bountyId: r.target_id,
      title: (r.target_id && titles.get(r.target_id)) || "Bounty",
      payoutUSD: Number((r.meta as { solverCut?: number })?.solverCut ?? 0),
      solvedAt: r.created_at,
    }));

    const postedDTO: DashboardBountyPosted[] = ((posted ?? []) as Array<Record<string, unknown>>).map((b) => ({
      id: String(b.id),
      title: String(b.title ?? ""),
      category: String(b.category ?? ""),
      priceUSD: Number(b.price_usd ?? 0),
      status: String(b.status ?? "active"),
      deadlineAt: (b.deadline_at as string | null) ?? null,
      createdAt: String(b.created_at),
    }));

    return { posted: postedDTO, solved };
  });

/* -------------------------------------------------------------------------- */
/*  Courses tab                                                                */
/* -------------------------------------------------------------------------- */

export interface DashboardEnrolledCourse {
  id: string;
  courseId: string;
  title: string;
  coverPath: string | null;
  slug: string | null;
  totalModules: number;
  completedModules: number;
  completedAt: string | null;
  enrolledAt: string;
}

export interface DashboardPublishedCourse {
  id: string;
  title: string;
  slug: string | null;
  coverPath: string | null;
  priceUSD: number;
  isPublished: boolean;
  isFree: boolean;
  enrollments: number;
  revenueUSD: number;
  createdAt: string;
}

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enrolled: DashboardEnrolledCourse[]; published: DashboardPublishedCourse[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const { data: enrolls } = await sb
      .from("course_enrollments")
      .select("id, course_id, completed_at, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false });
    const eRows = (enrolls ?? []) as Array<{ id: string; course_id: string; completed_at: string | null; created_at: string }>;
    const courseIds = eRows.map((r) => r.course_id);

    let courseMap = new Map<string, { title: string; slug: string | null; cover_path: string | null }>();
    let modulesMap = new Map<string, number>();
    let progressMap = new Map<string, number>();
    if (courseIds.length) {
      const [{ data: cs }, { data: ms }, { data: pr }] = await Promise.all([
        sb.from("courses").select("id, title, slug, cover_path").in("id", courseIds),
        sb.from("course_modules").select("id, course_id").in("course_id", courseIds),
        sb.from("course_progress").select("course_id, module_id").eq("user_id", me).in("course_id", courseIds),
      ]);
      courseMap = new Map(((cs ?? []) as Array<{ id: string; title: string; slug: string | null; cover_path: string | null }>).map((c) => [c.id, c]));
      for (const m of ((ms ?? []) as Array<{ course_id: string }>)) {
        modulesMap.set(m.course_id, (modulesMap.get(m.course_id) ?? 0) + 1);
      }
      for (const p of ((pr ?? []) as Array<{ course_id: string }>)) {
        progressMap.set(p.course_id, (progressMap.get(p.course_id) ?? 0) + 1);
      }
    }

    const enrolled: DashboardEnrolledCourse[] = eRows.map((r) => {
      const c = courseMap.get(r.course_id);
      return {
        id: r.id,
        courseId: r.course_id,
        title: c?.title ?? "Course",
        coverPath: c?.cover_path ?? null,
        slug: c?.slug ?? null,
        totalModules: modulesMap.get(r.course_id) ?? 0,
        completedModules: progressMap.get(r.course_id) ?? 0,
        completedAt: r.completed_at,
        enrolledAt: r.created_at,
      };
    });

    const { data: mine } = await sb
      .from("courses")
      .select("id, title, slug, cover_path, price_usd, is_published, is_free, created_at")
      .eq("owner_id", me)
      .order("created_at", { ascending: false });
    const mineRows = (mine ?? []) as Array<{ id: string; title: string; slug: string | null; cover_path: string | null; price_usd: number; is_published: boolean; is_free: boolean; created_at: string }>;
    const myIds = mineRows.map((r) => r.id);
    const enrollCount = new Map<string, { count: number; revenue: number }>();
    if (myIds.length) {
      const { data: byCourse } = await sb.from("course_enrollments").select("course_id, amount_paid_usd").in("course_id", myIds);
      for (const e of ((byCourse ?? []) as Array<{ course_id: string; amount_paid_usd: number }>)) {
        const cur = enrollCount.get(e.course_id) ?? { count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += Number(e.amount_paid_usd || 0);
        enrollCount.set(e.course_id, cur);
      }
    }
    const published: DashboardPublishedCourse[] = mineRows.map((r) => {
      const stats = enrollCount.get(r.id) ?? { count: 0, revenue: 0 };
      return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        coverPath: r.cover_path,
        priceUSD: Number(r.price_usd || 0),
        isPublished: !!r.is_published,
        isFree: !!r.is_free,
        enrollments: stats.count,
        revenueUSD: Number(stats.revenue.toFixed(2)),
        createdAt: r.created_at,
      };
    });

    return { enrolled, published };
  });

/* -------------------------------------------------------------------------- */
/*  Wallet & earnings tab                                                      */
/* -------------------------------------------------------------------------- */

export interface DashboardWalletSummary {
  balances: Array<{ currency: string; available: number; escrow: number }>;
  recent: Array<{ id: string; type: string; amount: number; currency: string; inflow: boolean; status: string; occurredAt: string }>;
  pendingPayouts: Array<{ id: string; amount: number; currency: string; method: string; status: string; createdAt: string }>;
}

export const getMyWalletSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardWalletSummary> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;
    const [w, tx, po] = await Promise.all([
      sb.from("wallets").select("currency, available_balance, escrow_balance").eq("user_id", me),
      sb.from("wallet_transactions").select("id, type, amount, currency, inflow, status, occurred_at").eq("user_id", me).order("occurred_at", { ascending: false }).limit(10),
      sb.from("payout_requests").select("id, amount, currency, method, status, created_at").eq("user_id", me).in("status", ["pending", "approved"]).order("created_at", { ascending: false }),
    ]);
    return {
      balances: ((w.data ?? []) as Array<{ currency: string; available_balance: number; escrow_balance: number }>).map((r) => ({
        currency: r.currency,
        available: Number(r.available_balance || 0),
        escrow: Number(r.escrow_balance || 0),
      })),
      recent: ((tx.data ?? []) as Array<{ id: string; type: string; amount: number; currency: string; inflow: boolean; status: string; occurred_at: string }>).map((r) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        currency: r.currency,
        inflow: r.inflow,
        status: r.status,
        occurredAt: r.occurred_at,
      })),
      pendingPayouts: ((po.data ?? []) as Array<{ id: string; amount: number; currency: string; method: string; status: string; created_at: string }>).map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency,
        method: r.method,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  });

/* -------------------------------------------------------------------------- */
/*  Social tab                                                                 */
/* -------------------------------------------------------------------------- */

export interface DashboardSocialUser {
  userId: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  at: string;
}

export interface DashboardSocialCircle {
  id: string;
  name: string;
  slug: string;
  role: string;
  emoji: string | null;
  joinedAt: string;
}

export interface DashboardSocial {
  followers: DashboardSocialUser[];
  following: DashboardSocialUser[];
  circles: DashboardSocialCircle[];
}

export const getMySocial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardSocial> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const [followersRes, followingRes, circlesRes] = await Promise.all([
      sb.from("follows").select("follower_id, created_at").eq("followee_id", me).order("created_at", { ascending: false }).limit(100),
      sb.from("follows").select("followee_id, created_at").eq("follower_id", me).order("created_at", { ascending: false }).limit(100),
      sb.from("circle_members").select("circle_id, role, joined_at").eq("user_id", me).order("joined_at", { ascending: false }),
    ]);

    const followerIds = ((followersRes.data ?? []) as Array<{ follower_id: string; created_at: string }>).map((r) => r.follower_id);
    const followingIds = ((followingRes.data ?? []) as Array<{ followee_id: string; created_at: string }>).map((r) => r.followee_id);
    const allUserIds = Array.from(new Set([...followerIds, ...followingIds]));

    let userMap = new Map<string, { slug: string; name: string; avatar: string | null }>();
    if (allUserIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id, slug, display_name, username, avatar_path")
        .in("user_id", allUserIds);
      userMap = new Map(
        ((profs ?? []) as Array<{ user_id: string; slug: string; display_name: string | null; username: string | null; avatar_path: string | null }>).map((p) => [
          p.user_id,
          { slug: p.slug, name: p.display_name || p.username || "Peer", avatar: p.avatar_path },
        ]),
      );
    }

    const followers: DashboardSocialUser[] = ((followersRes.data ?? []) as Array<{ follower_id: string; created_at: string }>).map((r) => {
      const p = userMap.get(r.follower_id);
      return { userId: r.follower_id, slug: p?.slug ?? r.follower_id, name: p?.name ?? "Peer", avatarUrl: p?.avatar ?? null, at: r.created_at };
    });
    const following: DashboardSocialUser[] = ((followingRes.data ?? []) as Array<{ followee_id: string; created_at: string }>).map((r) => {
      const p = userMap.get(r.followee_id);
      return { userId: r.followee_id, slug: p?.slug ?? r.followee_id, name: p?.name ?? "Peer", avatarUrl: p?.avatar ?? null, at: r.created_at };
    });

    const cRows = (circlesRes.data ?? []) as Array<{ circle_id: string; role: string; joined_at: string }>;
    const circleIds = cRows.map((r) => r.circle_id);
    let circleMap = new Map<string, { name: string; slug: string; emoji: string | null }>();
    if (circleIds.length) {
      const { data: cs } = await sb.from("circles").select("id, name, slug, emoji").in("id", circleIds);
      circleMap = new Map(((cs ?? []) as Array<{ id: string; name: string; slug: string; emoji: string | null }>).map((c) => [c.id, { name: c.name, slug: c.slug, emoji: c.emoji }]));
    }
    const circles: DashboardSocialCircle[] = cRows.map((r) => {
      const c = circleMap.get(r.circle_id);
      return { id: r.circle_id, name: c?.name ?? "Circle", slug: c?.slug ?? r.circle_id, role: r.role, emoji: c?.emoji ?? null, joinedAt: r.joined_at };
    });

    return { followers, following, circles };
  });
