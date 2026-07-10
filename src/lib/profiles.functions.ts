import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type {
  ProfileBounty,
  ProfileGroup,
  ProfileListing,
  ProfilePost,
} from "./profiles/mockProfiles";

const TabEnum = z.enum(["posts", "groups", "marketplace", "posted", "solved"]);
const SortEnum = z.enum([
  "newest",
  "most_liked",
  "most_commented",
  "most_members",
  "alpha",
  "price_low",
  "price_high",
  "most_sold",
  "highest_bounty",
  "lowest_bounty",
  "most_applicants",
]);
export type ProfileSortKey = z.infer<typeof SortEnum>;

const TabInput = z.object({
  profileId: z.string().trim().min(1).max(120),
  tab: TabEnum,
  page: z.number().int().min(1).max(200).default(1),
  pageSize: z.number().int().min(1).max(50).default(6),
  q: z.string().trim().max(120).optional().default(""),
  sort: SortEnum.optional().default("newest"),
});

export type ProfileTabItem =
  | ProfilePost
  | ProfileGroup
  | ProfileListing
  | ProfileBounty;

export interface ProfileTabPage {
  items: ProfileTabItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const getProfileTab = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TabInput.parse(input))
  .handler(async ({ data }): Promise<ProfileTabPage> => {
    const { loadProfileTab } = await import("@/lib/profiles/data.server");
    // Small artificial latency so pagination UX is observable in the demo.
    await new Promise((r) => setTimeout(r, 120));
    return loadProfileTab(data.profileId, data.tab, data.page, data.pageSize, {
      q: data.q,
      sort: data.sort,
    });
  });


const KindEnum = z.enum(["post", "group", "listing", "bounty", "solved"]);
const ItemInput = z.object({
  profileId: z.string().trim().min(1).max(120),
  kind: KindEnum,
  itemId: z.string().trim().min(1).max(200),
});

export type ProfileItemKind = z.infer<typeof KindEnum>;

export const getProfileItem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ItemInput.parse(input))
  .handler(async ({ data }): Promise<{ item: ProfileTabItem | null }> => {
    const { loadProfileItem } = await import("@/lib/profiles/data.server");
    const item = loadProfileItem(data.profileId, data.kind, data.itemId);
    return { item };
  });


// ---------------------------------------------------------------------------
// Real profile view (by user_id UUID or slug/username). Falls back cleanly
// when nothing matches so the route can render an empty state.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RealProfileView {
  userId: string;
  slug: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verificationTier: string;
  reputationStars: number;
  country: string | null;
  joined: string; // ISO
}

const ViewInput = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export const getProfileByIdOrSlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ViewInput.parse(input))
  .handler(async ({ data }): Promise<{ profile: RealProfileView | null }> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const looksLikeUuid = UUID_RE.test(data.idOrSlug);
    const query = supabase
      .from("profiles")
      .select(
        "user_id, slug, display_name, username, bio, avatar_path, verification_tier, reputation_stars, created_at",
      )
      .limit(1);

    const { data: row, error } = looksLikeUuid
      ? await query.eq("user_id", data.idOrSlug).maybeSingle()
      : await query.or(`slug.eq.${data.idOrSlug},username.eq.${data.idOrSlug}`).maybeSingle();

    if (error) {
      console.error("[getProfileByIdOrSlug] read failed", error);
      return { profile: null };
    }
    if (!row) return { profile: null };

    // Sign the avatar path (bucket is private).
    let avatarUrl: string | null = null;
    if (row.avatar_path) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(row.avatar_path, 60 * 60 * 24 * 7);
      avatarUrl = signed?.signedUrl ?? null;
    }

    return {
      profile: {
        userId: row.user_id,
        slug: row.slug,
        displayName: row.display_name ?? row.username ?? row.slug,
        username: row.username,
        bio: row.bio,
        avatarUrl,
        verificationTier: row.verification_tier,
        reputationStars: Number(row.reputation_stars ?? 0),
        country: null,
        joined: row.created_at,
      },
    };
  });


// ---------------------------------------------------------------------------
// Update the authenticated user's own profile (name, bio, avatar path).
// ---------------------------------------------------------------------------

const UpdateInput = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(280).optional().nullable(),
  avatarPath: z.string().trim().max(300).optional().nullable(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      display_name?: string;
      bio?: string | null;
      avatar_path?: string | null;
    } = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatarPath !== undefined) patch.avatar_path = data.avatarPath;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) {
      console.error("[updateMyProfile] update failed", error);
      throw new Error("Failed to update profile");
    }
    return { ok: true };
  });


// ---------------------------------------------------------------------------
// Live profile tab / item — queries the real Supabase tables tied to the
// resolved profile owner. Falls back cleanly to empty pages when a tab has
// no real data source (groups, solved).
// ---------------------------------------------------------------------------

const LiveTabInput = z.object({
  idOrSlug: z.string().trim().min(1).max(120),
  tab: TabEnum,
  page: z.number().int().min(1).max(200).default(1),
  pageSize: z.number().int().min(1).max(50).default(6),
  q: z.string().trim().max(120).optional().default(""),
  sort: SortEnum.optional().default("newest"),
});

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
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

async function resolveUserId(
  supabase: any,
  idOrSlug: string,
): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .or(`slug.eq.${idOrSlug},username.eq.${idOrSlug}`)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}


function serverClient() {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getLiveProfileTab = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => LiveTabInput.parse(input))
  .handler(async ({ data }): Promise<ProfileTabPage> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const userId = await resolveUserId(supabase, data.idOrSlug);
    const empty: ProfileTabPage = {
      items: [],
      total: 0,
      page: data.page,
      pageSize: data.pageSize,
      hasMore: false,
    };
    if (!userId) return empty;

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    if (data.tab === "posts") {
      let q = supabase
        .from("posts")
        .select("id, text, created_at, media_path", { count: "exact" })
        .eq("author_id", userId);
      if (data.q) q = q.ilike("text", `%${data.q}%`);
      q = q.order("created_at", { ascending: false }).range(from, to);
      const { data: rows, count } = await q;
      const ids = (rows ?? []).map((r) => r.id as string);
      const [likesRes, commentsRes] = await Promise.all([
        ids.length
          ? supabase.from("post_likes").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        ids.length
          ? supabase.from("post_comments").select("post_id").in("post_id", ids)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);
      const likeMap = new Map<string, number>();
      const commentMap = new Map<string, number>();
      for (const r of (likesRes.data ?? []) as { post_id: string }[])
        likeMap.set(r.post_id, (likeMap.get(r.post_id) ?? 0) + 1);
      for (const r of (commentsRes.data ?? []) as { post_id: string }[])
        commentMap.set(r.post_id, (commentMap.get(r.post_id) ?? 0) + 1);
      let items: ProfilePost[] = (rows ?? []).map((r) => ({
        id: r.id as string,
        content: (r.text as string) ?? "",
        timeAgo: timeAgo(r.created_at as string),
        likes: likeMap.get(r.id as string) ?? 0,
        comments: commentMap.get(r.id as string) ?? 0,
      }));
      if (data.sort === "most_liked") items = [...items].sort((a, b) => b.likes - a.likes);
      else if (data.sort === "most_commented")
        items = [...items].sort((a, b) => b.comments - a.comments);
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "marketplace") {
      let q = supabase
        .from("products")
        .select("id, name, category, price_usd, created_at", { count: "exact" })
        .eq("seller_id", userId);
      if (data.q) q = q.ilike("name", `%${data.q}%`);
      if (data.sort === "price_low") q = q.order("price_usd", { ascending: true });
      else if (data.sort === "price_high") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "alpha") q = q.order("name", { ascending: true });
      else q = q.order("created_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const ids = (rows ?? []).map((r) => r.id as string);
      const salesRes = ids.length
        ? await supabase
            .from("orders")
            .select("product_id")
            .in("product_id", ids)
            .eq("status", "paid")
        : { data: [] as { product_id: string }[] };
      const salesMap = new Map<string, number>();
      for (const r of (salesRes.data ?? []) as { product_id: string }[])
        salesMap.set(r.product_id, (salesMap.get(r.product_id) ?? 0) + 1);
      let items: ProfileListing[] = (rows ?? []).map((r) => ({
        id: r.id as string,
        title: (r.name as string) ?? "Untitled",
        category: (r.category as string) ?? "General",
        priceUsd: Number(r.price_usd ?? 0),
        sales: salesMap.get(r.id as string) ?? 0,
      }));
      if (data.sort === "most_sold") items = [...items].sort((a, b) => b.sales - a.sales);
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "posted") {
      let q = supabase
        .from("bounties")
        .select("id, title, price_usd, applicant_limit, status, created_at", { count: "exact" })
        .eq("poster_id", userId)
        .neq("status", "solved");
      if (data.q) q = q.ilike("title", `%${data.q}%`);
      if (data.sort === "highest_bounty") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "lowest_bounty") q = q.order("price_usd", { ascending: true });
      else q = q.order("created_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const items: ProfileBounty[] = (rows ?? []).map((r: any) => ({
        id: r.id as string,
        title: (r.title as string) ?? "Untitled",
        amountUsd: Number(r.price_usd ?? 0),
        applicants: Number(r.applicant_limit ?? 0),
        status: "open",
      }));
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "solved") {
      let q = supabase
        .from("bounties")
        .select("id, title, price_usd, status, updated_at", { count: "exact" })
        .eq("poster_id", userId)
        .eq("status", "solved");
      if (data.q) q = q.ilike("title", `%${data.q}%`);
      if (data.sort === "highest_bounty") q = q.order("price_usd", { ascending: false });
      else if (data.sort === "lowest_bounty") q = q.order("price_usd", { ascending: true });
      else q = q.order("updated_at", { ascending: false });
      const { data: rows, count } = await q.range(from, to);
      const items: ProfileBounty[] = (rows ?? []).map((r: any) => ({
        id: r.id as string,
        title: (r.title as string) ?? "Untitled",
        amountUsd: Number(r.price_usd ?? 0),
        proof: "Marked solved on Oventric.",
        status: "solved",
      }));
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    if (data.tab === "groups") {
      // Resolve profile's own slug so we can find inbound circle requests too.
      const { data: prof } = await supabase
        .from("profiles")
        .select("slug")
        .eq("user_id", userId)
        .maybeSingle();
      const mySlug = (prof as { slug?: string } | null)?.slug ?? null;

      let q = supabase
        .from("circle_requests")
        .select("id, requester_id, target_slug, created_at", { count: "exact" })
        .eq("status", "accepted");
      q = mySlug
        ? q.or(`requester_id.eq.${userId},target_slug.eq.${mySlug}`)
        : q.eq("requester_id", userId);
      q = q.order("created_at", { ascending: false }).range(from, to);
      const { data: rows, count } = await q;

      // Collect peer identifiers to resolve friendly names.
      const peerSlugs: string[] = [];
      const peerIds: string[] = [];
      for (const r of (rows ?? []) as any[]) {
        if (r.requester_id === userId) peerSlugs.push(r.target_slug);
        else peerIds.push(r.requester_id);
      }
      const [bySlug, byId] = await Promise.all([
        peerSlugs.length
          ? supabase.from("profiles").select("slug, display_name").in("slug", peerSlugs)
          : Promise.resolve({ data: [] as any[] }),
        peerIds.length
          ? supabase.from("profiles").select("user_id, display_name, slug").in("user_id", peerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const slugName = new Map<string, string>();
      for (const p of (bySlug.data ?? []) as any[])
        slugName.set(p.slug, p.display_name ?? p.slug);
      const idName = new Map<string, string>();
      for (const p of (byId.data ?? []) as any[])
        idName.set(p.user_id, p.display_name ?? p.slug ?? "Member");

      let items: ProfileGroup[] = (rows ?? []).map((r: any) => {
        const name =
          r.requester_id === userId
            ? slugName.get(r.target_slug) ?? r.target_slug
            : idName.get(r.requester_id) ?? "Member";
        return { id: r.id as string, name, members: 2, tag: "Circle" };
      });
      if (data.q) items = items.filter((g) => g.name.toLowerCase().includes(data.q.toLowerCase()));
      if (data.sort === "alpha") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
      const total = count ?? items.length;
      return { items, total, page: data.page, pageSize: data.pageSize, hasMore: from + items.length < total };
    }

    return empty;

  });

const LiveItemInput = z.object({
  idOrSlug: z.string().trim().min(1).max(120),
  kind: KindEnum,
  itemId: z.string().trim().min(1).max(200),
});

export const getLiveProfileItem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => LiveItemInput.parse(input))
  .handler(async ({ data }): Promise<{ item: ProfileTabItem | null }> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (data.kind === "post") {
      const { data: row } = await supabase
        .from("posts")
        .select("id, text, created_at")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!row) return { item: null };
      const [likes, comments] = await Promise.all([
        supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", row.id),
        supabase.from("post_comments").select("post_id", { count: "exact", head: true }).eq("post_id", row.id),
      ]);
      const item: ProfilePost = {
        id: row.id as string,
        content: (row.text as string) ?? "",
        timeAgo: timeAgo(row.created_at as string),
        likes: likes.count ?? 0,
        comments: comments.count ?? 0,
      };
      return { item };
    }

    if (data.kind === "listing") {
      const { data: row } = await supabase
        .from("products")
        .select("id, name, category, price_usd")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!row) return { item: null };
      const { count } = await supabase
        .from("orders")
        .select("product_id", { count: "exact", head: true })
        .eq("product_id", row.id)
        .eq("status", "paid");
      const item: ProfileListing = {
        id: row.id as string,
        title: (row.name as string) ?? "Untitled",
        category: (row.category as string) ?? "General",
        priceUsd: Number(row.price_usd ?? 0),
        sales: count ?? 0,
      };
      return { item };
    }

    if (data.kind === "bounty" || data.kind === "solved") {
      const { data: row } = await supabase
        .from("bounties")
        .select("id, title, price_usd, applicant_limit, status")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!row) return { item: null };
      const item: ProfileBounty = {
        id: row.id as string,
        title: (row.title as string) ?? "Untitled",
        amountUsd: Number(row.price_usd ?? 0),
        applicants: Number(row.applicant_limit ?? 0),
        status: data.kind === "solved" ? "solved" : "open",
      };
      return { item };
    }

    return { item: null };
  });


// ---------------------------------------------------------------------------
// Live reputation — real metrics derived from public tables (bounties, posts,
// products). Returns a normalized breakdown consumable by the profile UI.
// ---------------------------------------------------------------------------

export interface LiveReputationItem {
  key: string;
  label: string;
  detail: string;
  weight: number; // 0-1
  score: number; // 0-1 normalized
  raw: string;
}

export interface LiveReputation {
  stars: number; // 0-5
  items: LiveReputationItem[];
  metrics: {
    bountiesSolved: number;
    bountiesPosted: number;
    productsListed: number;
    avgProductRating: number;
    productReviewCount: number;
    postsTotal: number;
    postsLast30d: number;
  };
}

const RepInput = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export const getLiveReputation = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => RepInput.parse(input))
  .handler(async ({ data }): Promise<{ reputation: LiveReputation | null }> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const userId = await resolveUserId(supabase, data.idOrSlug);
    if (!userId) return { reputation: null };

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [bountiesSolvedRes, bountiesPostedRes, productsRes, postsTotalRes, posts30dRes] =
      await Promise.all([
        supabase
          .from("bounties")
          .select("id", { count: "exact", head: true })
          .eq("poster_id", userId)
          .eq("status", "solved"),
        supabase
          .from("bounties")
          .select("id", { count: "exact", head: true })
          .eq("poster_id", userId),
        supabase.from("products").select("rating, reviews").eq("seller_id", userId),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId)
          .gte("created_at", since30d),
      ]);

    const bountiesSolved = bountiesSolvedRes.count ?? 0;
    const bountiesPosted = bountiesPostedRes.count ?? 0;
    const productsRows = (productsRes.data ?? []) as Array<{
      rating: number | null;
      reviews: number | null;
    }>;
    const productsListed = productsRows.length;
    let ratingWeighted = 0;
    let reviewSum = 0;
    for (const p of productsRows) {
      const r = Number(p.rating ?? 0);
      const rv = Number(p.reviews ?? 0);
      if (rv > 0 && r > 0) {
        ratingWeighted += r * rv;
        reviewSum += rv;
      }
    }
    const avgProductRating = reviewSum > 0 ? ratingWeighted / reviewSum : 0;
    const postsTotal = postsTotalRes.count ?? 0;
    const postsLast30d = posts30dRes.count ?? 0;

    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const ratingScore = clamp(avgProductRating / 5);
    const solvedScore = clamp(bountiesSolved / 15);
    const marketScore = clamp(productsListed / 10);
    const activityScore = clamp(postsLast30d / 20);
    const contribScore = clamp((postsTotal + bountiesPosted) / 60);

    const items: LiveReputationItem[] = [
      {
        key: "rating",
        label: "Product rating",
        detail: "Weighted average of reviews on your marketplace listings",
        weight: 0.3,
        score: ratingScore,
        raw:
          reviewSum > 0
            ? `${avgProductRating.toFixed(1)} ★ · ${reviewSum} review${reviewSum === 1 ? "" : "s"}`
            : "No reviews yet",
      },
      {
        key: "solved",
        label: "Bounties solved",
        detail: "Bounties you posted that reached a solved state",
        weight: 0.25,
        score: solvedScore,
        raw: `${bountiesSolved} solved`,
      },
      {
        key: "market",
        label: "Marketplace listings",
        detail: "Digital products currently published under your account",
        weight: 0.15,
        score: marketScore,
        raw: `${productsListed} listed`,
      },
      {
        key: "activity",
        label: "Recent activity",
        detail: "Posts published in the last 30 days",
        weight: 0.15,
        score: activityScore,
        raw: `${postsLast30d} in 30d`,
      },
      {
        key: "contrib",
        label: "Overall contribution",
        detail: "Lifetime posts + bounties posted on Oventric",
        weight: 0.15,
        score: contribScore,
        raw: `${postsTotal + bountiesPosted} total`,
      },
    ];

    const weighted = items.reduce((s, i) => s + i.score * i.weight, 0);
    const stars = Math.round(weighted * 5 * 10) / 10;

    return {
      reputation: {
        stars,
        items,
        metrics: {
          bountiesSolved,
          bountiesPosted,
          productsListed,
          avgProductRating: Math.round(avgProductRating * 10) / 10,
          productReviewCount: reviewSum,
          postsTotal,
          postsLast30d,
        },
      },
    };
  });





