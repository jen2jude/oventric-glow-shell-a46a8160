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
}

export interface SearchResultCircle {
  kind: "circle";
  id: string;
  slug: string;
  name: string;
  emoji: string;
  memberCount: number;
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
  | SearchResultCircle
  | SearchResultPost;

export interface SearchResults {
  peers: SearchResultPeer[];
  bounties: SearchResultBounty[];
  products: SearchResultProduct[];
  circles: SearchResultCircle[];
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

    const [peersRes, bountiesRes, productsRes] = await Promise.all([
      sb
        .from("profiles")
        .select("user_id, slug, display_name, username, avatar_path, reputation_stars")
        .or(
          `display_name.ilike.${like},username.ilike.${like},slug.ilike.${like}`,
        )
        .limit(8),
      sb
        .from("bounties")
        .select("id, title, price_usd, cover_path, category, status")
        .eq("status", "active")
        .or(`title.ilike.${like},category.ilike.${like}`)
        .order("price_usd", { ascending: false })
        .limit(8),
      sb
        .from("products")
        .select("id, name, category, price_usd, cover_path, vendor")
        .or(`name.ilike.${like},category.ilike.${like},vendor.ilike.${like}`)
        .order("reviews", { ascending: false, nullsFirst: false })
        .limit(8),
    ]);

    const peerRows = (peersRes.data ?? []).filter(
      (p) => !!p.display_name && p.slug && !/^user-[a-f0-9]+$/i.test(p.slug as string),
    );
    const peerAvatars = await signBucket(sb, "avatars", peerRows.map((p) => p.avatar_path));
    const peers: SearchResultPeer[] = peerRows.map((p, i) => ({
      kind: "peer",
      id: p.user_id as string,
      slug: p.slug as string,
      name: (p.display_name || p.username || p.slug) as string,
      username: (p.username as string) ?? null,
      avatarUrl: peerAvatars[i],
      stars: Number(p.reputation_stars ?? 0),
    }));

    const bRows = bountiesRes.data ?? [];
    const bCovers = await signBucket(sb, "bounty-covers", bRows.map((b) => b.cover_path));
    const bounties: SearchResultBounty[] = bRows.map((b, i) => ({
      kind: "bounty",
      id: b.id as string,
      title: b.title as string,
      amountUsd: Number(b.price_usd ?? 0),
      category: (b.category as string) ?? null,
      coverUrl: bCovers[i],
    }));

    const pRows = productsRes.data ?? [];
    const pCovers = await signBucket(sb, "product-covers", pRows.map((p) => p.cover_path));
    const products: SearchResultProduct[] = pRows.map((p, i) => ({
      kind: "product",
      id: p.id as string,
      title: p.name as string,
      category: (p.category as string) ?? "misc",
      priceUsd: Number(p.price_usd ?? 0),
      vendor: (p.vendor as string) ?? "",
      coverUrl: pCovers[i],
    }));

    return { peers, bounties, products };
  });
