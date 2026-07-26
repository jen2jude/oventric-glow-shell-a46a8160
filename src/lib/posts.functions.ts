import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ReactionType = "love" | "like" | "laugh" | "crown";
export const REACTION_TYPES: ReactionType[] = ["love", "like", "laugh", "crown"];

export interface MentionRef {
  user_id: string;
  name: string;
  slug: string | null;
}

export interface PostMediaItem {
  url: string;
  type: "image" | "video";
}

export interface PostCircleRef {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  viewerIsMember: boolean;
}

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
  // Legacy fields (kept so existing render paths keep working for single-media rows).
  media_url: string | null;
  media_type: "image" | "video" | null;
  // Ordered list of all media items for this post (up to 10 images, or 1 video).
  media: PostMediaItem[];
  mentions: MentionRef[];
  circle: PostCircleRef | null;
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
    .select("id, author_id, text, created_at, media_path, media_type, media_paths, mentioned_user_ids" as any)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[listPosts] failed", error);
    throw new Error("Failed to load posts");
  }
  const rows = (posts ?? []) as Array<any>;
  if (rows.length === 0) return { posts: [] as FeedPost[] };

  const authorIds = new Set<string>(rows.map((r) => r.author_id));
  const mentionedByPost = new Map<string, string[]>();
  rows.forEach((r) => {
    const ids = Array.isArray(r.mentioned_user_ids) ? (r.mentioned_user_ids as string[]) : [];
    mentionedByPost.set(r.id, ids);
    ids.forEach((id) => authorIds.add(id));
  });
  const allProfileIds = Array.from(authorIds);
  const postIds = rows.map((r) => r.id);

  const [{ data: profiles }, likesRes, { data: commentRows }] = await Promise.all([
    sb.from("profiles").select("user_id, display_name, username, slug, avatar_path").in("user_id", allProfileIds),
    sb.from("post_likes").select("post_id, user_id, reaction" as any).in("post_id", postIds),
    sb.from("post_comments").select("post_id").in("post_id", postIds),
  ]);

  const avatarPaths = Array.from(
    new Set(((profiles ?? []).map((p) => p.avatar_path).filter((p): p is string => !!p))),
  );
  const avatarByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signed } = await sb.storage.from("avatars").createSignedUrls(avatarPaths, 60 * 60 * 6);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) avatarByPath.set(s.path, s.signedUrl); });
  }

  // Collect every media path across legacy + new arrays and sign them all in one round-trip.
  const allMediaPaths = new Set<string>();
  rows.forEach((r) => {
    if (r.media_path) allMediaPaths.add(r.media_path as string);
    const arr = Array.isArray(r.media_paths) ? (r.media_paths as string[]) : [];
    arr.forEach((p) => { if (p) allMediaPaths.add(p); });
  });
  const signedByPath = new Map<string, string>();
  if (allMediaPaths.size > 0) {
    // Sign with admin client so we can lock down post-media SELECT policy to owner-only.
    // Post visibility/audience filtering is already enforced by the posts RLS above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("post-media")
      .createSignedUrls(Array.from(allMediaPaths), 60 * 60 * 6);
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
    const legacyType = (r.media_type as "image" | "video" | null) ?? null;
    const arrPaths = Array.isArray(r.media_paths) ? (r.media_paths as string[]) : [];
    const media: PostMediaItem[] = [];
    if (arrPaths.length > 0) {
      // New multi-image posts: media_paths is images, `media_type` optionally 'video' for a single video row.
      const kind: "image" | "video" = legacyType === "video" && arrPaths.length === 1 ? "video" : "image";
      arrPaths.forEach((p) => {
        const url = signedByPath.get(p);
        if (url) media.push({ url, type: kind });
      });
    } else if (r.media_path) {
      const url = signedByPath.get(r.media_path);
      if (url) media.push({ url, type: legacyType ?? "image" });
    }
    const primary = media[0] ?? null;
    return {
      id: r.id,
      author_id: r.author_id,
      author_name: name,
      author_slug: prof?.slug ?? null,
      author_avatar_url: prof?.avatar_path ? (avatarByPath.get(prof.avatar_path) ?? null) : null,
      initials: initialsFrom(name, "OV"),
      text: r.text,
      created_at: r.created_at,
      likes_count: total,
      viewer_liked: viewer_reaction !== null,
      viewer_reaction,
      reactions,
      comments_count: commentCounts.get(r.id) ?? 0,
      media_url: primary?.url ?? null,
      media_type: primary?.type ?? null,
      media,
      mentions: (mentionedByPost.get(r.id) ?? [])
        .map((uid): MentionRef | null => {
          const p = profileById.get(uid);
          if (!p) return null;
          return {
            user_id: uid,
            name: (p.display_name || p.username || "Member") as string,
            slug: (p.slug as string) ?? null,
          };
        })
        .filter((m): m is MentionRef => m !== null),
    };
  });
  return { posts: out };
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      text: z.string().trim().min(1).max(4000),
      // Legacy single-media (kept for old callers).
      mediaPath: z.string().trim().min(1).max(500).optional(),
      mediaType: z.enum(["image", "video"]).optional(),
      // New multi-image support (up to 10). Videos still use `mediaPath`.
      mediaPaths: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
      audience: z.enum(["public", "circle", "followers"]).optional(),
      circleId: z.string().uuid().nullable().optional(),
      mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const audience = data.audience ?? "public";
    const circleId = audience === "circle" ? (data.circleId ?? null) : null;
    if (audience === "circle" && !circleId) {
      throw new Error("Choose a circle to share to");
    }
    if (circleId) {
      const { data: mem } = await context.supabase
        .from("circle_members")
        .select("circle_id")
        .eq("circle_id", circleId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!mem) throw new Error("You are not a member of that circle");
    }
    const mentioned = Array.from(new Set(data.mentionedUserIds ?? [])).filter(
      (id) => id !== context.userId,
    );

    const paths = Array.isArray(data.mediaPaths) ? data.mediaPaths.slice(0, 10) : [];
    // If a caller sends multiple images we store them in media_paths.
    // For a single video we still use the legacy media_path/media_type route.
    const isVideo = data.mediaType === "video" && !!data.mediaPath;
    const legacyPath = isVideo ? data.mediaPath! : (paths.length === 0 ? (data.mediaPath ?? null) : null);
    const legacyType = isVideo ? "video" : (paths.length === 0 ? (data.mediaPath ? (data.mediaType ?? null) : null) : "image");

    const { data: row, error } = await (context.supabase as any)
      .from("posts")
      .insert({
        author_id: context.userId,
        text: data.text,
        media_path: legacyPath,
        media_type: legacyType,
        media_paths: paths,
        audience,
        circle_id: circleId,
        mentioned_user_ids: mentioned,
      })
      .select("id, author_id, text, created_at")
      .single();
    if (error || !row) {
      console.error("[createPost] failed", error);
      throw new Error("Failed to create post");
    }

    if (mentioned.length > 0) {
      const { data: me } = await context.supabase
        .from("profiles")
        .select("display_name, username, slug")
        .eq("user_id", context.userId)
        .maybeSingle();
      const authorName = me?.display_name || me?.username || "Someone";
      const rows = mentioned.map((uid) => ({
        user_id: uid,
        from_user_id: context.userId,
        kind: "mention",
        title: `${authorName} mentioned you`,
        body: data.text.slice(0, 140),
        link: `/#post-${row.id}`,
      }));
      const { error: notifErr } = await context.supabase.from("notifications").insert(rows);
      if (notifErr) console.error("[createPost] mention notif insert failed", notifErr);
    }

    return { post: row };
  });

export const searchMentionCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const like = `%${data.q.replace(/[\\%_,]/g, (m) => `\\${m}`)}%`;
    const { data: rows } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, username, slug, avatar_path")
      .or(`display_name.ilike.${like},username.ilike.${like},slug.ilike.${like}`)
      .limit(8);
    const list = (rows ?? []).filter((p) => p.user_id !== context.userId);
    const paths = list.map((p) => p.avatar_path).filter((p): p is string => !!p);
    const map = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await context.supabase.storage
        .from("avatars")
        .createSignedUrls(paths, 60 * 60);
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
      });
    }
    return {
      users: list.map((p) => ({
        userId: p.user_id as string,
        name: (p.display_name || p.username || p.slug || "Member") as string,
        username: (p.username as string) ?? null,
        slug: (p.slug as string) ?? null,
        avatarUrl: p.avatar_path ? (map.get(p.avatar_path) ?? null) : null,
      })),
    };
  });

export const listMyPostableCircles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mem } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", context.userId);
    const ids = (mem ?? []).map((r: any) => r.circle_id as string);
    if (ids.length === 0) return { circles: [] as { id: string; name: string }[] };
    const { data: rows } = await context.supabase
      .from("circles")
      .select("id, name")
      .in("id", ids)
      .order("name", { ascending: true });
    return { circles: (rows ?? []).map((r: any) => ({ id: r.id, name: r.name })) };
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

export interface UserPhoto {
  url: string;
  source: "avatar" | "cover" | "post";
  postId: string | null;
  createdAt: string; // ISO
}

/**
 * List every image the user has shared (avatar, cover, and post images).
 * Signed in only — signs URLs against the viewer's session.
 * `slugOrId` may be a profile slug OR a user_id (UUID). When omitted,
 * returns photos for the current viewer ("My Memories").
 */
export const listUserPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      slugOrId: z.string().trim().min(1).max(120).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId: viewerId } = context;
    // Resolve target user.
    let targetId: string | null = null;
    let profileRow: { avatar_path: string | null; cover_path: string | null; updated_at: string | null; created_at: string | null } | null = null;
    if (!data.slugOrId) {
      targetId = viewerId;
    } else if (/^[0-9a-f-]{36}$/i.test(data.slugOrId)) {
      targetId = data.slugOrId;
    }
    if (targetId) {
      const { data: p } = await sb
        .from("profiles")
        .select("user_id, avatar_path, cover_path, updated_at, created_at" as any)
        .eq("user_id", targetId)
        .maybeSingle();
      profileRow = (p as any) ?? null;
    } else {
      const { data: p } = await sb
        .from("profiles")
        .select("user_id, avatar_path, cover_path, updated_at, created_at" as any)
        .eq("slug", data.slugOrId!)
        .maybeSingle();
      if (p) {
        targetId = (p as any).user_id;
        profileRow = p as any;
      }
    }
    if (!targetId) return { photos: [] as UserPhoto[] };

    const { data: postRows } = await sb
      .from("posts")
      .select("id, created_at, media_path, media_type, media_paths" as any)
      .eq("author_id", targetId)
      .order("created_at", { ascending: false })
      .limit(200);

    // Gather every path to sign.
    const items: Array<{ path: string; source: UserPhoto["source"]; postId: string | null; createdAt: string; bucket: "avatars" | "profile-covers" | "post-media" }> = [];
    if (profileRow?.avatar_path) {
      items.push({
        path: profileRow.avatar_path,
        source: "avatar",
        postId: null,
        createdAt: profileRow.updated_at ?? profileRow.created_at ?? new Date().toISOString(),
        bucket: "avatars",
      });
    }
    if (profileRow?.cover_path) {
      items.push({
        path: profileRow.cover_path,
        source: "cover",
        postId: null,
        createdAt: profileRow.updated_at ?? profileRow.created_at ?? new Date().toISOString(),
        bucket: "profile-covers",
      });
    }
    (postRows ?? []).forEach((r: any) => {
      const arr: string[] = Array.isArray(r.media_paths) ? r.media_paths : [];
      if (arr.length > 0) {
        const isImage = r.media_type !== "video" || arr.length > 1;
        if (isImage) {
          arr.forEach((p) => items.push({ path: p, source: "post", postId: r.id, createdAt: r.created_at, bucket: "post-media" }));
        }
      } else if (r.media_path && r.media_type !== "video") {
        items.push({ path: r.media_path, source: "post", postId: r.id, createdAt: r.created_at, bucket: "post-media" });
      }
    });

    // Sign per-bucket in parallel.
    const buckets: Array<UserPhoto["source"] extends string ? "avatars" | "profile-covers" | "post-media" : never> = ["avatars", "profile-covers", "post-media"];
    const byBucket = new Map<string, string[]>();
    items.forEach((it) => {
      const arr = byBucket.get(it.bucket) ?? [];
      arr.push(it.path);
      byBucket.set(it.bucket, arr);
    });
    const signedByPath = new Map<string, string>();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all(
      buckets.map(async (b) => {
        const paths = Array.from(new Set(byBucket.get(b) ?? []));
        if (paths.length === 0) return;
        const { data: signed } = await supabaseAdmin.storage.from(b).createSignedUrls(paths, 60 * 60 * 6);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) signedByPath.set(`${b}:${s.path}`, s.signedUrl);

        });
      }),
    );

    const photos: UserPhoto[] = items
      .map((it) => {
        const url = signedByPath.get(`${it.bucket}:${it.path}`);
        if (!url) return null;
        return { url, source: it.source, postId: it.postId, createdAt: it.createdAt };
      })
      .filter((v): v is UserPhoto => v !== null);

    return { photos };
  });

