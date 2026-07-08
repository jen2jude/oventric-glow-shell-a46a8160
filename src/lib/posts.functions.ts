import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface FeedPost {
  id: string;
  author_id: string;
  author_name: string;
  author_slug: string | null;
  initials: string;
  text: string;
  created_at: string;
  likes_count: number;
  viewer_liked: boolean;
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

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: posts, error } = await supabase
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

    const [{ data: profiles }, { data: likes }, { data: myLikes }, { data: commentRows }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, username, slug").in("user_id", authorIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
    ]);

    // Generate signed URLs for media (private bucket)
    const mediaPaths = rows.map((r) => r.media_path).filter((p): p is string => !!p);
    const signedByPath = new Map<string, string>();
    if (mediaPaths.length) {
      const { data: signed } = await supabase.storage
        .from("post-media")
        .createSignedUrls(mediaPaths, 60 * 60 * 6); // 6h
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
      });
    }

    const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const likeCounts = new Map<string, number>();
    (likes ?? []).forEach((l) => likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1));
    const likedSet = new Set((myLikes ?? []).map((l) => l.post_id));
    const commentCounts = new Map<string, number>();
    (commentRows ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));

    const out: FeedPost[] = rows.map((r) => {
      const prof = profileById.get(r.author_id);
      const name = prof?.display_name || prof?.username || "Member";
      return {
        id: r.id,
        author_id: r.author_id,
        author_name: name,
        author_slug: prof?.slug ?? null,
        initials: initialsFrom(name, "OV"),
        text: r.text,
        created_at: r.created_at,
        likes_count: likeCounts.get(r.id) ?? 0,
        viewer_liked: likedSet.has(r.id),
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

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid(), like: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.like) {
      const { error } = await context.supabase
        .from("post_likes")
        .insert({ post_id: data.postId, user_id: context.userId });
      // Ignore duplicate-key errors (idempotent like).
      if (error && error.code !== "23505") {
        console.error("[toggleLike] insert failed", error);
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
