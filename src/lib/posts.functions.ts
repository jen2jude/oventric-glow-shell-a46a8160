import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ReactionType = "love" | "like" | "laugh" | "crown";
export const REACTION_TYPES: ReactionType[] = ["love", "like", "laugh", "crown"];

export interface FeedPost {
  id: string;
  author_id: string;
  author_name: string;
  author_slug: string | null;
  author_avatar_url: string | null;
  initials: string;
  text: string;
  created_at: string;
  likes_count: number;
  viewer_liked: boolean;
  viewer_reaction: ReactionType | null;
  reactions: Record<ReactionType, number>;
  comments_count: number;
  media_url: string | null;
  media_type: "image" | "video" | null;
}

function initialsFrom(name: string | null | undefined, fallback: string): string {
  const src = (name ?? "").trim();
  if (!src) return fallback.slice(0, 2).toUpperCase();
  const parts = src.split(/\s+/).filter(Boolean);
  const chars = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return chars.toUpperCase();
}

async function getViewerClient(): Promise<{ sb: SupabaseClient<Database>; userId: string | null }> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const req = getRequest();
  const authHeader = req?.headers?.get?.("authorization") ?? null;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token && token.split(".").length === 3) {
    const sb = createClient<Database>(SUPABASE_URL, KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data } = await sb.auth.getClaims(token);
      const userId = (data?.claims?.sub as string | undefined) ?? null;
      return { sb, userId };
    } catch {
      /* fall through */
    }
  }
  const sb = createClient<Database>(SUPABASE_URL, KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { sb, userId: null };
}

function zeroReactions(): Record<ReactionType, number> {
  return { love: 0, like: 0, laugh: 0, crown: 0 };
}

export const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { sb, userId } = await getViewerClient();

  const { data: posts, error } = await sb
    .from("posts")
    .select("id, author_id, text, created_at, media_path, media_type")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[listPosts] failed", error);
    throw new Error("Failed to load posts");
  }
  const rows = posts ?? [];
  if (rows.length === 0) return { posts: [] as FeedPost[] };

  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const postIds = rows.map((r) => r.id);

  const [{ data: profiles }, likesRes, { data: commentRows }] = await Promise.all([
    sb.from("profiles").select("user_id, display_name, username, slug").in("user_id", authorIds),
    sb.from("post_likes").select("post_id, user_id, reaction" as any).in("post_id", postIds),
    sb.from("post_comments").select("post_id").in("post_id", postIds),
  ]);

  const mediaPaths = userId
    ? rows.map((r) => r.media_path).filter((p): p is string => !!p)
    : [];
  const signedByPath = new Map<string, string>();
  if (mediaPaths.length) {
    const { data: signed } = await sb.storage
      .from("post-media")
      .createSignedUrls(mediaPaths, 60 * 60 * 6);
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    });
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const reactionsByPost = new Map<string, Record<ReactionType, number>>();
  const viewerReactionByPost = new Map<string, ReactionType>();
  ((likesRes.data ?? []) as any[]).forEach((row) => {
    const kind = (REACTION_TYPES as string[]).includes(row.reaction) ? (row.reaction as ReactionType) : "love";
    const bucket = reactionsByPost.get(row.post_id) ?? zeroReactions();
    bucket[kind] += 1;
    reactionsByPost.set(row.post_id, bucket);
    if (userId && row.user_id === userId) viewerReactionByPost.set(row.post_id, kind);
  });
  const commentCounts = new Map<string, number>();
  (commentRows ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));

  const out: FeedPost[] = rows.map((r) => {
    const prof = profileById.get(r.author_id);
    const name = prof?.display_name || prof?.username || "Member";
    const reactions = reactionsByPost.get(r.id) ?? zeroReactions();
    const total = reactions.love + reactions.like + reactions.laugh + reactions.crown;
    const viewer_reaction = viewerReactionByPost.get(r.id) ?? null;
    return {
      id: r.id,
      author_id: r.author_id,
      author_name: name,
      author_slug: prof?.slug ?? null,
      initials: initialsFrom(name, "OV"),
      text: r.text,
      created_at: r.created_at,
      likes_count: total,
      viewer_liked: viewer_reaction !== null,
      viewer_reaction,
      reactions,
      comments_count: commentCounts.get(r.id) ?? 0,
      media_url: r.media_path ? (signedByPath.get(r.media_path) ?? null) : null,
      media_type: (r.media_type as "image" | "video" | null) ?? null,
    };
  });
  return { posts: out };
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      text: z.string().trim().min(1).max(4000),
      mediaPath: z.string().trim().min(1).max(500).optional(),
      mediaType: z.enum(["image", "video"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("posts")
      .insert({
        author_id: context.userId,
        text: data.text,
        media_path: data.mediaPath ?? null,
        media_type: data.mediaPath ? (data.mediaType ?? null) : null,
      })
      .select("id, author_id, text, created_at")
      .single();
    if (error || !row) {
      console.error("[createPost] failed", error);
      throw new Error("Failed to create post");
    }
    return { post: row };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("posts")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId);
    if (error) {
      console.error("[deletePost] failed", error);
      throw new Error("Failed to delete post");
    }
    return { id: data.id };
  });

// Set (or clear) the viewer's reaction on a post. Passing null removes it.
export const setReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      postId: z.string().uuid(),
      reaction: z.enum(["love", "like", "laugh", "crown"]).nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.reaction === null) {
      const { error } = await context.supabase
        .from("post_likes")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[setReaction] delete failed", error);
        throw new Error("Failed to remove reaction");
      }
    } else {
      const { error } = await context.supabase
        .from("post_likes")
        .upsert(
          { post_id: data.postId, user_id: context.userId, reaction: data.reaction } as any,
          { onConflict: "post_id,user_id" },
        );
      if (error) {
        console.error("[setReaction] upsert failed", error);
        throw new Error("Failed to react");
      }
    }
    return { postId: data.postId, reaction: data.reaction };
  });

// Legacy alias kept so any older callers still compile. Prefer setReaction.
export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid(), like: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.like) {
      const { error } = await context.supabase
        .from("post_likes")
        .upsert(
          { post_id: data.postId, user_id: context.userId, reaction: "love" } as any,
          { onConflict: "post_id,user_id" },
        );
      if (error && (error as any).code !== "23505") {
        console.error("[toggleLike] upsert failed", error);
        throw new Error("Failed to like");
      }
    } else {
      const { error } = await context.supabase
        .from("post_likes")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", context.userId);
      if (error) {
        console.error("[toggleLike] delete failed", error);
        throw new Error("Failed to unlike");
      }
    }
    return { postId: data.postId, liked: data.like };
  });
