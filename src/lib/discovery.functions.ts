import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface DiscoveryPeer {
  id: string;
  slug: string;
  name: string;
  initials: string;
  stars: number;
  avatarUrl: string | null;
  gradient: string;
}

export interface DiscoveryBounty {
  id: string;
  title: string;
  amountUsd: number;
  coverUrl: string | null;
  category: string | null;
}

export interface DiscoveryProduct {
  id: string;
  title: string;
  category: string;
  priceUsd: number;
  coverUrl: string | null;
  hue: string;
  vendor: string;
}

export interface DiscoveryAd {
  id: string;
  advertiser: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  tier: "text" | "image" | "video";
  coverUrl: string | null;
}

export interface DiscoveryFeed {
  peers: DiscoveryPeer[];
  bounties: DiscoveryBounty[];
  products: DiscoveryProduct[];
  ads: DiscoveryAd[];
}

const GRADIENTS = [
  "from-purple-500 to-pink-500",
  "from-orange-400 to-red-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-indigo-500",
  "from-fuchsia-500 to-purple-700",
  "from-amber-400 to-orange-600",
  "from-cyan-400 to-blue-600",
  "from-rose-400 to-pink-600",
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function serverPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function signBucket(
  sb: ReturnType<typeof serverPublicClient>,
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<(string | null)[]> {
  const clean = paths.map((p) => (typeof p === "string" && p ? p : null));
  const unique = Array.from(new Set(clean.filter((p): p is string => !!p)));
  if (unique.length === 0) return clean.map(() => null);
  const { data } = await sb.storage.from(bucket).createSignedUrls(unique, 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => {
    if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  });
  return clean.map((p) => (p ? (map.get(p) ?? null) : null));
}

export const getDiscoveryFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscoveryFeed> => {
    const sb = serverPublicClient();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesRes, bountiesRes, productsRes, adsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, slug, display_name, username, avatar_path")
        .not("display_name", "is", null)
        .limit(200),
      sb
        .from("bounties")
        .select("id, title, price_usd, cover_path, category, status, end_at")
        .eq("status", "active")
        .order("price_usd", { ascending: false })
        .limit(25),
      sb
        .from("products")
        .select("id, name, category, price_usd, cover_path, hue, vendor, promoted, reviews, rating")
        .order("promoted", { ascending: false })
        .order("reviews", { ascending: false })
        .order("rating", { ascending: false })
        .limit(30),
      sb
        .from("ad_campaigns")
        .select("id, advertiser, title, header, body, cta_label, cta_url, tier, media_url, media_path, placements, status, start_at, end_at")
        .eq("status", "active")
        .limit(20),
    ]);

    // ---- Peers: compute REAL reputation stars from live activity; keep only top-tier (>= 4.0) ----
    const profileRows = (profilesRes.data ?? []).filter(
      (p) => !!p.display_name && p.slug && !/^user-[a-f0-9]+$/i.test(p.slug as string),
    );
    const candidateIds = profileRows.map((p) => p.user_id as string);

    let allProducts: Array<{ seller_id: string; rating: number | null; reviews: number | null }> = [];
    let allBounties: Array<{ poster_id: string; status: string | null }> = [];
    let allPosts: Array<{ author_id: string; created_at: string }> = [];

    if (candidateIds.length > 0) {
      const [prodAll, bntAll, postAll] = await Promise.all([
        supabaseAdmin.from("products").select("seller_id, rating, reviews").in("seller_id", candidateIds),
        supabaseAdmin.from("bounties").select("poster_id, status").in("poster_id", candidateIds),
        supabaseAdmin.from("posts").select("author_id, created_at").in("author_id", candidateIds),
      ]);
      allProducts = (prodAll.data ?? []) as typeof allProducts;
      allBounties = (bntAll.data ?? []) as typeof allBounties;
      allPosts = (postAll.data ?? []) as typeof allPosts;
    }

    const since30d = Date.now() - 30 * 24 * 3600 * 1000;
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

    const statsByUser = new Map<string, {
      ratingWeighted: number; reviewSum: number; productsListed: number;
      bountiesSolved: number; bountiesPosted: number;
      postsTotal: number; postsLast30d: number;
    }>();
    const stat = (uid: string) => {
      let s = statsByUser.get(uid);
      if (!s) {
        s = { ratingWeighted: 0, reviewSum: 0, productsListed: 0, bountiesSolved: 0, bountiesPosted: 0, postsTotal: 0, postsLast30d: 0 };
        statsByUser.set(uid, s);
      }
      return s;
    };
    for (const p of allProducts) {
      const s = stat(p.seller_id);
      s.productsListed += 1;
      const r = Number(p.rating ?? 0);
      const rv = Number(p.reviews ?? 0);
      if (rv > 0 && r > 0) { s.ratingWeighted += r * rv; s.reviewSum += rv; }
    }
    for (const b of allBounties) {
      const s = stat(b.poster_id);
      s.bountiesPosted += 1;
      if (b.status === "solved") s.bountiesSolved += 1;
    }
    for (const p of allPosts) {
      const s = stat(p.author_id);
      s.postsTotal += 1;
      if (new Date(p.created_at).getTime() >= since30d) s.postsLast30d += 1;
    }

    const scored = profileRows.map((p) => {
      const s = statsByUser.get(p.user_id as string) ?? { ratingWeighted: 0, reviewSum: 0, productsListed: 0, bountiesSolved: 0, bountiesPosted: 0, postsTotal: 0, postsLast30d: 0 };
      const avgRating = s.reviewSum > 0 ? s.ratingWeighted / s.reviewSum : 0;
      const weighted =
        clamp01(avgRating / 5) * 0.3 +
        clamp01(s.bountiesSolved / 15) * 0.25 +
        clamp01(s.productsListed / 10) * 0.15 +
        clamp01(s.postsLast30d / 20) * 0.15 +
        clamp01((s.postsTotal + s.bountiesPosted) / 60) * 0.15;
      const stars = Math.round(weighted * 5 * 10) / 10;
      return { p, stars };
    });

    // Only top-tier peers (>= 4.0 stars), highest first.
    const topScored = scored
      .filter((x) => x.stars >= 4.0)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 10);

    const avatarUrls = await signBucket(sb, "avatars", topScored.map((x) => x.p.avatar_path));
    const peers: DiscoveryPeer[] = topScored.map((x, i) => {
      const name = (x.p.display_name || x.p.username || x.p.slug) as string;
      return {
        id: x.p.user_id as string,
        slug: x.p.slug as string,
        name,
        initials: initialsFor(name),
        stars: x.stars,
        avatarUrl: avatarUrls[i],
        gradient: GRADIENTS[i % GRADIENTS.length],
      };
    });

    // ---- Bounties (top 5 by escrow) ----
    const bRows = bountiesRes.data ?? [];
    const bCovers = await signBucket(sb, "bounty-covers", bRows.map((b) => b.cover_path));
    const bountiesAll: DiscoveryBounty[] = bRows.map((b, i) => ({
      id: b.id as string,
      title: b.title as string,
      amountUsd: Number(b.price_usd ?? 0),
      coverUrl: bCovers[i],
      category: (b.category as string) ?? null,
    }));
    const bounties = bountiesAll.slice(0, 5);

    // ---- Products (10 trending, randomized between visits) ----
    const pRows = productsRes.data ?? [];
    const pCovers = await signBucket(sb, "product-covers", pRows.map((p) => p.cover_path));
    const productsAll: DiscoveryProduct[] = pRows.map((p, i) => ({
      id: p.id as string,
      title: p.name as string,
      category: (p.category as string) ?? "misc",
      priceUsd: Number(p.price_usd ?? 0),
      coverUrl: pCovers[i],
      hue: (p.hue as string) ?? "from-emerald-500 to-teal-600",
      vendor: (p.vendor as string) ?? "",
    }));
    const products = shuffle(productsAll).slice(0, 10);

    // ---- Sponsored (filter by placement + active window, randomize) ----
    const now = Date.now();
    const adRows = (adsRes.data ?? []).filter((a) => {
      const placements = (a.placements as string[]) ?? [];
      if (!placements.includes("feed") && !placements.includes("marketplace")) return false;
      if (a.start_at && new Date(a.start_at as string).getTime() > now) return false;
      if (a.end_at && new Date(a.end_at as string).getTime() < now) return false;
      return true;
    });
    const adCovers = await signBucket(
      sb,
      "product-covers",
      adRows.map((a) => (a.media_path && !a.media_url ? (a.media_path as string) : null)),
    );
    const adsAll: DiscoveryAd[] = adRows.map((a, i) => ({
      id: a.id as string,
      advertiser: (a.advertiser as string) ?? "Sponsor",
      title: (a.title as string) || (a.header as string) || "Sponsored placement",
      body: (a.body as string) ?? "",
      ctaLabel: (a.cta_label as string) || "Learn more",
      ctaUrl: (a.cta_url as string) || "#",
      tier: ((a.tier as "text" | "image" | "video") ?? "text"),
      coverUrl: (a.media_url as string) || adCovers[i],
    }));
    const ads = shuffle(adsAll).slice(0, 5);

    return { peers, bounties, products, ads };
  },
);
