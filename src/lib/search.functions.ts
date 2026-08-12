import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export interface SearchResultPeer {
  kind: "peer";
  id: string;
  slug: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  stars: number;
  description?: string;
  hasShop: boolean;
  hasServices: boolean;
}

export interface SearchResultBounty {
  kind: "bounty";
  id: string;
  title: string;
  amountUsd: number;
  category: string | null;
  coverUrl: string | null;
}

export interface SearchResultProduct {
  kind: "product";
  id: string;
  title: string;
  category: string;
  priceUsd: number;
  vendor: string;
  coverUrl: string | null;
  sellerSlug: string;
}

export interface SearchResultShop {
  kind: "shop";
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  productCount: number;
  salesCount: number;
  stars: number;
}

export interface SearchResultService {
  kind: "service";
  id: string;
  title: string;
  providerName: string;
  providerSlug: string;
  priceUsd: number;
  coverUrl: string | null;
}

export interface SearchResultCourse {
  kind: "course";
  id: string;
  title: string;
  creatorName: string;
  creatorSlug: string;
  coverUrl: string | null;
}

export interface SearchResultPost {
  kind: "post";
  id: string;
  text: string;
  authorName: string;
  authorSlug: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

export type SearchResult =
  | SearchResultPeer
  | SearchResultBounty
  | SearchResultProduct
  | SearchResultShop
  | SearchResultService
  | SearchResultCourse
  | SearchResultPost;

export interface SearchResults {
  peers: SearchResultPeer[];
  bounties: SearchResultBounty[];
  products: SearchResultProduct[];
  shops: SearchResultShop[];
  services: SearchResultService[];
  courses: SearchResultCourse[];
  posts: SearchResultPost[];
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

function escapeLike(s: string): string {
  return s.replace(/[\\%_,]/g, (m) => `\\${m}`);
}

export const searchGlobal = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ q: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data }): Promise<SearchResults> => {
    const sb = serverPublicClient();
    const raw = data.q;
    const like = `%${escapeLike(raw)}%`;

    const [peersRes, bountiesRes, productsRes, postsRes, shopsRes, servicesRes, coursesRes] = await Promise.all([
      sb
        .from("profiles")
        .select("user_id, slug, display_name, username, avatar_path, reputation_stars, bio")
        .or(`display_name.ilike.${like},username.ilike.${like},slug.ilike.${like}`)
        .limit(8),
      sb
        .from("bounties")
        .select("id, title, price_usd, cover_path, category")
        .eq("status", "active")
        .or(`title.ilike.${like},category.ilike.${like}`)
        .limit(8),
      sb
        .from("products")
        .select("id, name, category, price_usd, cover_path, vendor, seller_id, kind")
        .eq("status", "active")
        .or(`name.ilike.${like},category.ilike.${like},vendor.ilike.${like}`)
        .limit(8),
      sb
        .from("posts")
        .select("id, text, created_at, author_id")
        .ilike("text", like)
        .order("created_at", { ascending: false })
        .limit(8),
        sb
        .from("profiles")
        .select("user_id, slug, display_name, avatar_path")
        .or(`display_name.ilike.${like},slug.ilike.${like}`)
        .limit(8),
        sb
        .from("products")
        .select("id, name, price_usd, cover_path, seller_id")
        .eq("kind", "service")
        .or(`name.ilike.${like},description.ilike.${like}`)
        .limit(8),
        sb
        .from("products")
        .select("id, name, cover_path, seller_id")
        .eq("kind", "course")
        .or(`name.ilike.${like},description.ilike.${like}`)
        .limit(8),
    ]);

    const peerRows = (peersRes.data ?? []).filter(
      (p) => !!p.display_name && p.slug && !/^user-[a-f0-9]+$/i.test(p.slug as string),
    );
    const peerAvatars = await signBucket(sb, "avatars", peerRows.map((p) => p.avatar_path));
    
    // Check if peers have shop/services
    const pIds = peerRows.map(p => p.user_id);
    const { data: pChecks } = await sb.from("products").select("seller_id, kind").in("seller_id", pIds);
    const peerHasShop = new Set<string>();
    const peerHasServices = new Set<string>();
    (pChecks ?? []).forEach(p => {
        if (p.kind !== 'service') peerHasShop.add(p.seller_id);
        else peerHasServices.add(p.seller_id);
    });

    const peers: SearchResultPeer[] = peerRows.map((p, i) => ({
      kind: "peer",
      id: p.user_id as string,
      slug: p.slug as string,
      name: (p.display_name || p.username || p.slug) as string,
      username: (p.username as string) ?? null,
      avatarUrl: peerAvatars[i],
      stars: Number(p.reputation_stars ?? 0),
      description: (p.bio as string) ?? undefined,
      hasShop: peerHasShop.has(p.user_id as string),
      hasServices: peerHasServices.has(p.user_id as string),
    }));

    const pRows = productsRes.data ?? [];
    const pCovers = await signBucket(sb, "product-covers", pRows.map((p) => p.cover_path));
    
    // Need seller slugs for product cards to link to shops
    const sellerIds = Array.from(new Set(pRows.map(p => p.seller_id)));
    const { data: sellerProfiles } = await sb.from("profiles").select("user_id, slug").in("user_id", sellerIds);
    const sellerSlugMap = new Map((sellerProfiles ?? []).map(s => [s.user_id, s.slug]));

    const products: SearchResultProduct[] = pRows.map((p, i) => ({
      kind: "product",
      id: p.id as string,
      title: p.name as string,
      category: (p.category as string) ?? "misc",
      priceUsd: Number(p.price_usd ?? 0),
      vendor: (p.vendor as string) ?? "",
      coverUrl: pCovers[i],
      sellerSlug: sellerSlugMap.get(p.seller_id as string) ?? "unknown",
    }));

    return { peers, bounties: [], products, shops: [], services: [], courses: [], posts: [] };
  });
