import { Paperclip, MessageSquare, Share2, Flag, Send, Pencil, Trash2, Check, X, RotateCcw, AlertCircle, Image as ImageIcon, Video as VideoIcon, Megaphone, ShieldAlert, Copyright, AlertTriangle, Play, BookOpen, User, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { ReportModal } from "@/components/oventric/ReportModal";
import { AdSlot } from "@/components/oventric/ads/AdSlot";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { DiscoveryPanel } from "@/components/oventric/DiscoveryPanel";
import { supabase } from "@/integrations/supabase/client";
import {
  addComment as addCommentFn,
  listComments as listCommentsFn,
  updateComment as updateCommentFn,
  deleteComment as deleteCommentFn,
  type FeedComment,
} from "@/lib/comments.functions";
import {
  listPosts as listPostsFn,
  createPost as createPostFn,
  deletePost as deletePostFn,
  setReaction as setReactionFn,
  type FeedPost,
  type ReactionType,
} from "@/lib/posts.functions";
import { requestJoinCircle as requestJoinCircleFn } from "@/lib/circles-groups.functions";
import {
  ReactionPicker,
  ReactionSplash,
  ReactionImageBadge,
  ReactionButton,
  REACTION_META,
} from "@/components/oventric/feed/Reactions";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";
import { VideoPlayerModal } from "@/components/oventric/feed/VideoPlayerModal";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import { TruncatedText } from "@/components/oventric/feed/TruncatedText";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { PostActionsMenu, shareUrl, getHiddenPosts } from "@/components/oventric/PostActionsMenu";
import { listBlogPosts, type BlogListItem } from "@/lib/blog.functions";
import { ShareSheet } from "@/components/oventric/ShareSheet";
import { PostComposerModal } from "@/components/oventric/PostComposerModal";

interface Comment {
  id: string;
  postId: string;
  author: string;
  authorId: string;
  initials: string;
  text: string;
  createdAt: string;
  status?: "pending" | "failed";
  errorMessage?: string;
}

function toComment(c: FeedComment): Comment {
  return {
    id: c.id,
    postId: c.post_id,
    author: c.author_name,
    authorId: c.author_id,
    initials: c.initials,
    text: c.text,
    createdAt: c.created_at,
  };
}

// Stable sort: by createdAt asc, tiebreak by id so re-renders don't reshuffle.
function sortComments(list: Comment[]): Comment[] {
  return list.slice().sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type FeedMosaicLayout = {
  wrapperClass: string;
  tileClasses: string[];
  displayedCount: number;
  isMosaic: boolean;
};

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFeedMosaicLayout(postId: string, imageCount: number): FeedMosaicLayout {
  if (imageCount <= 1) {
    return {
      wrapperClass: "grid grid-cols-1",
      tileClasses: [""],
      displayedCount: 1,
      isMosaic: false,
    };
  }

  if (imageCount === 2) {
    return {
      wrapperClass: "grid grid-cols-2 gap-1",
      tileClasses: ["", ""],
      displayedCount: 2,
      isMosaic: false,
    };
  }

  const variantsByCount: Record<number, Omit<FeedMosaicLayout, "isMosaic">[]> = {
    3: [
      {
        wrapperClass: "grid grid-cols-2 grid-rows-2 gap-1 aspect-[4/3]",
        tileClasses: ["row-span-2", "", ""],
        displayedCount: 3,
      },
      {
        wrapperClass: "grid grid-cols-2 grid-rows-2 gap-1 aspect-[4/3]",
        tileClasses: ["", "", "col-span-2"],
        displayedCount: 3,
      },
      {
        wrapperClass: "grid grid-cols-3 grid-rows-2 gap-1 aspect-[4/3]",
        tileClasses: ["col-span-2 row-span-2", "", ""],
        displayedCount: 3,
      },
    ],
    4: [
      {
        wrapperClass: "grid grid-cols-5 grid-rows-3 gap-1 aspect-[4/3]",
        tileClasses: ["col-span-3 row-span-3", "col-span-2", "col-span-2", "col-span-2"],
        displayedCount: 4,
      },
      {
        wrapperClass: "grid grid-cols-6 grid-rows-3 gap-1 aspect-[4/3]",
        tileClasses: ["col-span-3 row-span-2", "col-span-3 row-span-2", "col-span-3", "col-span-3"],
        displayedCount: 4,
      },
    ],
  };

  const fivePlusVariants: Omit<FeedMosaicLayout, "isMosaic">[] = [
    {
      wrapperClass: "grid grid-cols-6 grid-rows-3 gap-1 aspect-[4/3]",
      tileClasses: ["col-span-3 row-span-2", "col-span-3 row-span-2", "col-span-2", "col-span-2", "col-span-2"],
      displayedCount: 5,
    },
    {
      wrapperClass: "grid grid-cols-5 grid-rows-4 gap-1 aspect-[4/3]",
      tileClasses: ["col-span-3 row-span-4", "col-span-2", "col-span-2", "col-span-2", "col-span-2"],
      displayedCount: 5,
    },
  ];

  const variants = variantsByCount[imageCount] ?? fivePlusVariants;
  const picked = variants[stableHash(`${postId}:${imageCount}`) % variants.length];
  return {
    ...picked,
    displayedCount: Math.min(imageCount, picked.displayedCount),
    isMosaic: true,
  };
}

/**
 * Lightweight post-image wrapper that shows a neutral skeleton until the
 * image decodes, then fades in. Keeps feed scrolling smooth on low-end
 * Android and avoids blank flashes on slow connections.
 */
function FeedPostImage({
  src,
  alt,
  className,
  eager,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && (
        <span
          aria-hidden
          className="absolute inset-0 bg-white/5 md:bg-slate-100 animate-pulse"
        />
      )}
      <ResponsiveImage
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        {...(eager ? { fetchpriority: "high" as const } : {})}
        sizes="(min-width: 768px) 640px, 100vw"
        onLoad={() => setLoaded(true)}
        className={`${className ?? ""} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

interface ReportDetails {
  reason: string;
  reasonLabel: string;
  note: string | null;
}

const REASON_STYLES: Record<
  string,
  { icon: React.ElementType; label: string; border: string; bg: string; text: string }
> = {
  spam: {
    icon: Megaphone,
    label: "Spam",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
  },
  harassment: {
    icon: ShieldAlert,
    label: "Harassment",
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
  },
  ip: {
    icon: Copyright,
    label: "IP",
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
  },
  scam: {
    icon: AlertTriangle,
    label: "Scam",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-300",
  },
};

function ReportedBadge({ details }: { details?: ReportDetails }) {
  const style = details ? REASON_STYLES[details.reason] ?? REASON_STYLES.spam : REASON_STYLES.spam;
  const Icon = style.icon;
  const tooltip = details
    ? `Reason: ${details.reasonLabel}${details.note ? `\nNote: ${details.note}` : "\nNote: (none)"}`
    : "You reported this post";
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`ml-auto inline-flex items-center gap-1 rounded-md border ${style.border} ${style.bg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.text} cursor-help`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" /> Reported
    </span>
  );
}

export function Feed() {
  const { require, tier } = useOnboarding();
  

  const [meId, setMeId] = useState<string | null>(null);
  const [meLastName, setMeLastName] = useState<string>("");
  const [meAvatarUrl, setMeAvatarUrl] = useState<string | null>(null);
  const [meInitials, setMeInitials] = useState<string>("Me");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [mentionsSheet, setMentionsSheet] = useState<FeedPost["mentions"] | null>(null);

  const [composerDraft, setComposerDraft] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [attachment, setAttachment] = useState<{
    file: File;
    previewUrl: string;
    kind: "image" | "video";
  } | null>(null);

  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({});
  const [commentError, setCommentError] = useState<string | null>(null);
  const COMMENTS_PAGE_SIZE = 3;
  const [visibleComments, setVisibleComments] = useState<Record<string, number>>({});
  // Reservations of client tempIds for locally-created comments, keyed by
  // `${postId}::${authorId}::${text}`. Realtime INSERT consumes an entry to
  // adopt the real id in-place instead of appending a duplicate.
  const pendingSelfCommentsRef = useRef<Map<string, string[]>>(new Map());
  // Real ids we've already merged locally — realtime INSERT skips them.
  const knownCommentIdsRef = useRef<Set<string>>(new Set());
  // Synchronous guard to prevent double-submit before React re-renders.
  const postingGuardRef = useRef<Set<string>>(new Set());

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reported, setReported] = useState<Map<string, ReportDetails>>(() => {
    if (typeof window === "undefined") return new Map();
    try {
      const raw = window.localStorage.getItem("oventric.reported");
      if (!raw) return new Map();
      const parsed = Object.entries(JSON.parse(raw) as Record<string, ReportDetails>);
      return new Map(
        parsed.map(([id, details]) => [
          id,
          {
            reason: details.reason ?? "spam",
            reasonLabel: details.reasonLabel ?? "Spam",
            note: details.note ?? null,
          },
        ]),
      );
    } catch {
      return new Map();
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "oventric.reported",
        JSON.stringify(Object.fromEntries(reported)),
      );
    } catch {
      /* ignore quota */
    }
  }, [reported]);
  const markReported = (id: string, details: { reason: string; reasonLabel: string; note: string | null }) =>
    setReported((m) => {
      const next = new Map(m);
      next.set(id, { reason: details.reason, reasonLabel: details.reasonLabel, note: details.note });
      return next;
    });
  const openReport = (id: string) => {
    if (reported.has(id)) return;
    setReportOpen(id);
  };

  const listPosts = useServerFn(listPostsFn);
  const createPost = useServerFn(createPostFn);
  const deletePost = useServerFn(deletePostFn);
  const setReaction = useServerFn(setReactionFn);
  const requestJoinCircle = useServerFn(requestJoinCircleFn);
  const [joiningCircleIds, setJoiningCircleIds] = useState<Set<string>>(new Set());
  const handleJoinCircleFromFeed = (circleId: string, circleSlug: string) => {
    require(1, async () => {
      setJoiningCircleIds((s) => new Set(s).add(circleId));
      try {
        await requestJoinCircle({ data: { circleId } });
        // Refresh so viewerIsMember flips once approved and code-of-conduct is accepted.
        refreshPosts();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Circles" } }));
          const u = new URL(window.location.href);
          u.searchParams.set("circle", circleSlug);
          window.history.replaceState({}, "", u.toString());
        }
      } catch (e) {
        console.error("[Feed] join circle failed", e);
      } finally {
        setJoiningCircleIds((s) => {
          const next = new Set(s);
          next.delete(circleId);
          return next;
        });
      }
    }, "interaction");
  };
  const listComments = useServerFn(listCommentsFn);
  const addComment = useServerFn(addCommentFn);
  const updateComment = useServerFn(updateCommentFn);
  const deleteComment = useServerFn(deleteCommentFn);

  const refreshPosts = useCallback(async () => {
    try {
      const res = await listPosts();
      setPosts(res.posts);
      setPostsError(null);
    } catch (e) {
      console.error("[Feed] listPosts failed", e);
      setPostsError("Couldn't load feed.");
    }
  }, [listPosts]);

  // Current user id + last name
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      setMeId(uid);
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_path")
          .eq("user_id", uid)
          .maybeSingle();
        const name = (prof?.display_name || prof?.username || "").trim();
        if (name) {
          const parts = name.split(/\s+/);
          setMeLastName(parts.length > 1 ? parts[parts.length - 1] : parts[0]);
          setMeInitials(
            parts
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("") || "Me",
          );
        }
        if (prof?.avatar_path) {
          try {
            const { data: signed } = await supabase.storage
              .from("avatars")
              .createSignedUrl(prof.avatar_path, 60 * 60 * 24 * 7);
            if (signed?.signedUrl) setMeAvatarUrl(signed.signedUrl);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Rotate composer placeholder every 3s
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % 2), 3000);
    return () => clearInterval(t);
  }, []);

  // Open the composer modal when the create panel dispatches a "post" action.
  useEffect(() => {
    const onCreate = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind !== "post") return;
      setComposerOpen(true);
    };
    window.addEventListener("oventric:create", onCreate);
    return () => window.removeEventListener("oventric:create", onCreate);
  }, []);

  // Initial posts load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshPosts();
      if (!cancelled) setPostsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPosts]);

  // Realtime: posts + likes + comments
  useEffect(() => {
    const channel = supabase
      .channel("feed:live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          refreshPosts();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => {
          refreshPosts();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        (payload) => {
          const row = payload.new as FeedComment;
          if (knownCommentIdsRef.current.has(row.id)) {
            // Local swap already added this row; ignore realtime echo.
            knownCommentIdsRef.current.delete(row.id);
            return;
          }
          const dedupeKey = `${row.post_id}::${row.author_id}::${row.text}`;
          const queue = pendingSelfCommentsRef.current.get(dedupeKey);
          let adoptedTempId: string | null = null;
          if (queue && queue.length > 0) {
            adoptedTempId = queue.shift() ?? null;
            if (queue.length === 0) pendingSelfCommentsRef.current.delete(dedupeKey);
          }
          knownCommentIdsRef.current.add(row.id);
          setCommentsByPost((prev) => {
            const arr = prev[row.post_id] ?? [];
            if (arr.some((c) => c.id === row.id)) return prev;
            if (adoptedTempId) {
              const idx = arr.findIndex((c) => c.id === adoptedTempId);
              if (idx !== -1) {
                const next = arr.slice();
                next[idx] = toComment(row);
                return { ...prev, [row.post_id]: sortComments(next) };
              }
            }
            return { ...prev, [row.post_id]: sortComments([...arr, toComment(row)]) };
          });
          setPosts((prev) =>
            prev.map((p) =>
              p.id === row.post_id ? { ...p, comments_count: p.comments_count + 1 } : p,
            ),
          );
        },
      )

      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "post_comments" },
        (payload) => {
          const row = payload.new as FeedComment;
          setCommentsByPost((prev) => {
            const arr = prev[row.post_id];
            if (!arr) return prev;
            return { ...prev, [row.post_id]: sortComments(arr.map((c) => (c.id === row.id ? toComment(row) : c))) };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_comments" },
        (payload) => {
          const oldRow = payload.old as Partial<FeedComment>;
          if (!oldRow?.id || !oldRow.post_id) return;
          const postId = oldRow.post_id;
          setCommentsByPost((prev) => {
            const arr = prev[postId];
            if (!arr) return prev;
            return { ...prev, [postId]: arr.filter((c) => c.id !== oldRow.id) };
          });
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshPosts]);

  // Fetch comments for any post we don't have yet
  useEffect(() => {
    const missing = posts.filter((p) => !commentsByPost[p.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          missing.map((p) =>
            listComments({ data: { postId: p.id } }).then((r) => ({ id: p.id, list: r.comments })),
          ),
        );
        if (cancelled) return;
        setCommentsByPost((prev) => {
          const next = { ...prev };
          for (const { id, list } of results) next[id] = list.map(toComment);
          return next;
        });
      } catch (e) {
        console.error("[Feed] load comments failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, commentsByPost, listComments]);

  const openFilePicker = () => {
    setPostError(null);
    fileInputRef.current?.click();
  };

  const clearAttachment = () => {
    setAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setPostError("Only image or video files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setPostError("File is too large. Max size is 50 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({
      file,
      previewUrl: URL.createObjectURL(file),
      kind: isImage ? "image" : "video",
    });
  };

  const handleCreatePost = () => {
    const text = composerDraft.trim();
    if (!text || posting) return;
    require(1, async () => {
      setPosting(true);
      setPostError(null);
      try {
        let mediaPath: string | undefined;
        let mediaType: "image" | "video" | undefined;
        if (attachment) {
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes.user?.id;
          if (!uid) throw new Error("Not signed in");
          const ext = (attachment.file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
          const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("post-media")
            .upload(path, attachment.file, {
              contentType: attachment.file.type,
              cacheControl: "31536000",
              upsert: false,
            });
          if (upErr) throw upErr;
          mediaPath = path;
          mediaType = attachment.kind;
          if (attachment.kind === "video") {
            try {
              const { generateVideoPoster, posterPathFor } = await import("@/lib/media/videoPoster");
              const poster = await generateVideoPoster(attachment.file);
              if (poster) {
                await supabase.storage
                  .from("post-media")
                  .upload(posterPathFor(path), poster, {
                    contentType: "image/jpeg",
                    cacheControl: "31536000",
                    upsert: true,
                  });
              }
            } catch { /* poster is best-effort */ }
          }
        }
        await createPost({ data: { text, mediaPath, mediaType } });
        setComposerDraft("");
        clearAttachment();
        // realtime will refresh; nudge in case the channel is late
        refreshPosts();
      } catch (e) {
        console.error(e);
        setPostError("Couldn't publish post. Try again.");
      } finally {
        setPosting(false);
      }
    }, "interaction");
  };


  // Splash + picker state, keyed by post id.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [splash, setSplash] = useState<{ postId: string; reaction: ReactionType; id: number } | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [videoStartId, setVideoStartId] = useState<string | null>(null);
  const [commentsSheetPostId, setCommentsSheetPostId] = useState<string | null>(null);
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(() => getHiddenPosts());
  const [blogPosts, setBlogPosts] = useState<BlogListItem[]>([]);
  const [blogShare, setBlogShare] = useState<BlogListItem | null>(null);
  const listBlogFn = useServerFn(listBlogPosts);

  useEffect(() => {
    listBlogFn().then((r) => setBlogPosts(r.posts)).catch(() => {});
    const onUpdate = () => setHiddenPosts(getHiddenPosts());
    window.addEventListener("oventric:posts-updated", onUpdate);
    return () => window.removeEventListener("oventric:posts-updated", onUpdate);
  }, [listBlogFn]);

  const zeroCounts = (): Record<ReactionType, number> => ({ love: 0, like: 0, dislike: 0, laugh: 0, crown: 0 });

  const handleReact = (post: FeedPost, reaction: ReactionType | null) => {
    require(1, async () => {
      const prevReaction = post.viewer_reaction;
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== post.id) return p;
          const counts = { ...(p.reactions ?? zeroCounts()) };
          if (prevReaction) counts[prevReaction] = Math.max(0, counts[prevReaction] - 1);
          if (reaction) counts[reaction] = (counts[reaction] ?? 0) + 1;
          const total = counts.love + counts.like + counts.laugh + counts.crown;
          return {
            ...p,
            reactions: counts,
            viewer_reaction: reaction,
            viewer_liked: reaction !== null,
            likes_count: total,
          };
        }),
      );
      if (reaction) {
        setSplash({ postId: post.id, reaction, id: Date.now() });
        setTimeout(() => setSplash((s) => (s && s.postId === post.id ? null : s)), 950);
      }
      try {
        await setReaction({ data: { postId: post.id, reaction } });
      } catch (e) {
        console.error(e);
        // Revert on failure
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, viewer_reaction: prevReaction, viewer_liked: prevReaction !== null, reactions: post.reactions, likes_count: post.likes_count }
              : p,
          ),
        );
      }
    }, "interaction");
  };

  const handleDeletePost = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this post?")) return;
    const snapshot = posts;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    try {
      await deletePost({ data: { id } });
    } catch (e) {
      console.error(e);
      setPosts(snapshot);
    }
  };

  const dedupeKeyOf = (postId: string, authorId: string, text: string) =>
    `${postId}::${authorId}::${text}`;

  const reserveTempId = (key: string, tempId: string) => {
    const map = pendingSelfCommentsRef.current;
    const queue = map.get(key) ?? [];
    if (!queue.includes(tempId)) queue.push(tempId);
    map.set(key, queue);
  };

  const unreserveTempId = (key: string, tempId: string) => {
    const map = pendingSelfCommentsRef.current;
    const queue = map.get(key);
    if (!queue) return;
    const idx = queue.indexOf(tempId);
    if (idx !== -1) queue.splice(idx, 1);
    if (queue.length === 0) map.delete(key);
  };

  const sendCommentAttempt = async (postId: string, tempId: string, text: string) => {
    const authorId = meId ?? "me";
    const key = dedupeKeyOf(postId, authorId, text);
    reserveTempId(key, tempId);
    setCommentPosting((p) => ({ ...p, [tempId]: true }));
    setCommentError(null);
    // Mark as pending (clear any prior failed state) and bump createdAt so a
    // retried comment moves to the tail — matching where the server will
    // eventually place it after reconciliation.
    const attemptTs = new Date().toISOString();
    setCommentsByPost((prev) => {
      const arr = prev[postId] ?? [];
      return {
        ...prev,
        [postId]: sortComments(
          arr.map((c) =>
            c.id === tempId ? { ...c, status: "pending", errorMessage: undefined, createdAt: attemptTs } : c,
          ),
        ),
      };
    });
    try {
      const res = await addComment({
        data: { postId, text, authorName: "You", initials: "OV" },
      });
      const real = toComment(res.comment);
      // Race: if realtime already adopted the tempId, our reservation is gone
      // and the row is already merged under real.id — nothing to do.
      // Otherwise, claim the reservation, mark the id known so the realtime
      // echo is ignored, and swap the temp entry to real in-place.
      const stillReserved = pendingSelfCommentsRef.current.get(key)?.includes(tempId);
      if (stillReserved) {
        unreserveTempId(key, tempId);
        knownCommentIdsRef.current.add(real.id);
        setCommentsByPost((prev) => {
          const arr = prev[postId];
          if (!arr) return prev;
          if (arr.some((c) => c.id === real.id)) {
            return { ...prev, [postId]: sortComments(arr.filter((c) => c.id !== tempId)) };
          }
          return { ...prev, [postId]: sortComments(arr.map((c) => (c.id === tempId ? real : c))) };
        });
      }
    } catch (e) {
      console.error(e);
      unreserveTempId(key, tempId);
      const raw = e instanceof Error ? e.message : "Unknown error";
      const lower = raw.toLowerCase();
      const friendly = lower.includes("unauthorized") || lower.includes("401") || lower.includes("jwt")
        ? "Your session expired. Sign in again to post this comment."
        : lower.includes("row-level security") || lower.includes("permission") || lower.includes("403")
          ? "You don't have permission to post here."
          : lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")
            ? "Network hiccup. Check your connection and retry."
            : lower.includes("rate") || lower.includes("429")
              ? "You're posting too fast. Wait a moment and retry."
              : lower.includes("timeout")
                ? "Server took too long to respond. Retry in a moment."
                : `Couldn't post: ${raw}`;
      setCommentsByPost((prev) => {
        const arr = prev[postId] ?? [];
        return {
          ...prev,
          [postId]: arr.map((c) => (c.id === tempId ? { ...c, status: "failed", errorMessage: friendly } : c)),
        };
      });
      setCommentError(friendly);
    } finally {
      setCommentPosting((p) => {
        const next = { ...p };
        delete next[tempId];
        return next;
      });
    }
  };

  const submitComment = (postId: string) => {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text || commentPosting[postId] || postingGuardRef.current.has(postId)) return;
    require(1, async () => {
      if (postingGuardRef.current.has(postId)) return;
      postingGuardRef.current.add(postId);
      try {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic: Comment = {
          id: tempId,
          postId,
          author: "You",
          authorId: meId ?? "me",
          initials: "OV",
          text,
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        setCommentDrafts((d) => ({ ...d, [postId]: "" }));
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: sortComments([...(prev[postId] ?? []), optimistic]),
        }));
        setCommentPosting((p) => ({ ...p, [postId]: true }));
        try {
          await sendCommentAttempt(postId, tempId, text);
        } finally {
          setCommentPosting((p) => ({ ...p, [postId]: false }));
        }
      } finally {
        postingGuardRef.current.delete(postId);
      }
    }, "interaction");
  };

  const retryComment = (postId: string, tempId: string, text: string) => {
    void sendCommentAttempt(postId, tempId, text);
  };

  const discardFailedComment = (postId: string, tempId: string) => {
    const authorId = meId ?? "me";
    setCommentsByPost((prev) => {
      const arr = prev[postId];
      if (!arr) return prev;
      const target = arr.find((c) => c.id === tempId);
      if (target) unreserveTempId(dedupeKeyOf(postId, authorId, target.text), tempId);
      return { ...prev, [postId]: arr.filter((c) => c.id !== tempId) };
    });

  };


  const startEdit = (c: Comment) => {
    setEditing({ id: c.id, text: c.text });
    setCommentError(null);
  };
  const cancelEdit = () => setEditing(null);
  const saveEdit = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    setSavingEdit(true);
    try {
      await updateComment({ data: { id: editing.id, text } });
      setEditing(null);
    } catch (e) {
      console.error(e);
      setCommentError("Couldn't update comment. Try again.");
    } finally {
      setSavingEdit(false);
    }
  };
  const removeComment = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this comment?")) return;
    try {
      await deleteComment({ data: { id } });
    } catch (e) {
      console.error(e);
      setCommentError("Couldn't delete comment. Try again.");
    }
  };

  const handleBuy = () => require(2, () => alert("Proceeding to checkout (mock)"), "buyer");
  const handleBounty = () => require(2, () => alert("Applying to bounty (mock)"), "solver");
  const isLoggedIn = tier >= 1;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:bg-white md:min-h-screen lg:flex lg:flex-row lg:gap-6 lg:items-start lg:[scrollbar-gutter:stable]">
      <div className="w-full lg:flex-1 lg:min-w-0 flex flex-col space-y-4">
        {/* Composer */}
        <button
          id="oventric-composer"
          type="button"
          onClick={() => require(1, () => setComposerOpen(true), "seller")}
          className="group w-full text-left bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-4 md:p-3.5 flex items-center gap-3 transition-all duration-200 hover:bg-[#22222a] md:hover:bg-white md:hover:border-slate-300 md:hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 md:focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141418] md:focus-visible:ring-offset-white"
        >
          <span className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-neutral-800 md:bg-slate-200 md:ring-1 md:ring-slate-200 flex items-center justify-center">
            <AvatarImage src={meAvatarUrl} alt="Your profile" initials={meInitials} />
          </span>
          <span className="flex-1 min-w-0 md:rounded-full md:bg-slate-100 md:group-hover:bg-slate-100/80 md:px-4 md:py-2.5 md:transition-colors">
            <span className="block text-sm text-slate-400 md:text-slate-500 md:font-normal truncate">
              {placeholderIdx === 0
                ? `Hey${meLastName ? ` ${meLastName}` : ""}! What are you creating today?`
                : "What's on your mind today, update us!"}
            </span>
          </span>
          <span className="hidden sm:flex md:hidden text-[11px] text-slate-500">Photo · Video · @Mention</span>
          <span className="hidden md:flex items-center gap-1 shrink-0">
            {[
              { Icon: ImageIcon, label: "Photo", tone: "text-emerald-600 group-hover:bg-emerald-50" },
              { Icon: VideoIcon, label: "Video", tone: "text-rose-600 group-hover:bg-rose-50" },
              { Icon: AtSign, label: "Mention", tone: "text-sky-600 group-hover:bg-sky-50" },
            ].map(({ Icon, label, tone }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors ${tone}`}
              >
                <Icon className={`w-4 h-4 ${tone.split(" ")[0]}`} strokeWidth={2.2} />
                <span className="hidden lg:inline">{label}</span>
              </span>
            ))}
          </span>
        </button>


        <AdSlot placement="feed" variant="banner" />


        {/* Posts (live) */}
        {postsLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading feed">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-5 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] md:bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-white/[0.06] md:bg-slate-200 rounded" />
                    <div className="h-2 w-1/5 bg-white/[0.05] md:bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-11/12 bg-white/[0.06] md:bg-slate-200 rounded" />
                  <div className="h-3 w-4/5 bg-white/[0.06] md:bg-slate-200 rounded" />
                  <div className="h-3 w-2/3 bg-white/[0.05] md:bg-slate-200 rounded" />
                </div>
                <div className="h-40 w-full bg-white/[0.04] md:bg-slate-100 rounded-lg mb-4" />
                <div className="flex gap-6">
                  <div className="h-3 w-10 bg-white/[0.05] md:bg-slate-200 rounded" />
                  <div className="h-3 w-10 bg-white/[0.05] md:bg-slate-200 rounded" />
                  <div className="h-3 w-10 bg-white/[0.05] md:bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : postsError ? (
          <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-red-500/40 rounded-xl p-6 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 md:text-red-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-300 md:text-red-600">Couldn’t load the feed</p>
            <p className="mt-1 text-xs text-red-300/80">{postsError}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-400 md:text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-white md:text-slate-900">The feed is quiet right now</p>
            <p className="mt-1 text-xs text-slate-400 md:text-slate-600 max-w-sm mx-auto">
              No posts have been shared yet. Kick things off — share an update, ship a build log, or ask the network a question.
            </p>
          </div>

        ) : (
          (() => {
            const shareOrigin = typeof window !== "undefined" ? window.location.origin : "";
            const visible = posts.filter((p) => !hiddenPosts.has(p.id));
            const items: React.ReactNode[] = [];
            let blogIdx = 0;
            visible.forEach((post, i) => {
              items.push(renderPost(post));
              if ((i + 1) % 10 === 0 && blogPosts[blogIdx]) {
                const b = blogPosts[blogIdx++];
                items.push(
                  <div key={`blog-${b.id}`} className="relative bg-gradient-to-br from-[#1E1E24] to-[#191921] border border-emerald-500/30 rounded-xl overflow-hidden hover:border-emerald-500/60 transition">
                    <Link
                      to="/blog/$slug"
                      params={{ slug: b.slug }}
                      className="block"
                    >
                      {b.cover_url && (
                        <ResponsiveImage src={b.cover_url} alt={b.title} sizes="(min-width: 768px) 640px, 100vw" className="w-full aspect-[16/7] object-cover" />
                      )}

                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-400 md:text-emerald-600" />
                          <span className="text-[10px] uppercase tracking-wider text-emerald-400 md:text-emerald-600 font-bold">
                            Blog{b.category_name ? ` · ${b.category_name}` : ""}
                          </span>
                        </div>
                        <h3 className="text-white md:text-slate-900 text-lg font-black leading-tight">{b.title}</h3>
                        <p className="mt-1.5 text-sm text-slate-400 md:text-slate-600 line-clamp-3">{b.excerpt}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 md:text-slate-500">By {b.author_name}</span>
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold">
                            Read article →
                          </span>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBlogShare(b); }}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/60 backdrop-blur border border-white/10 text-slate-200 hover:text-white hover:bg-black/80"
                      aria-label="Share article"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>,
                );
              }
            });
            return items;

            function renderPost(post: FeedPost) {
              const comments = commentsByPost[post.id] ?? [];
              const isReported = reported.has(post.id);
              const profileSlug = post.author_slug ?? post.author_id;
              const shareHref = `${shareOrigin}/#post-${post.id}`;
              return (
              <article
                key={post.id}
                className={`bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-5 transition-opacity ${isReported ? "opacity-70" : ""}`}
                style={{ contentVisibility: "auto", containIntrinsicSize: "1px 600px" }}
              >
                <header className="flex items-center gap-3 mb-3">
                  <Link
                    to="/profile/$id"
                    params={{ id: profileSlug }}
                    className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 md:bg-slate-200 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-emerald-400/60 transition"
                  >
                    <AvatarImage
                      src={post.author_avatar_url}
                      alt={post.author_name}
                      initials={post.initials}
                    />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <Link
                        to="/profile/$id"
                        params={{ id: profileSlug }}
                        className="font-semibold text-white md:text-slate-900 text-sm hover:text-emerald-400 md:hover:text-emerald-600 transition-colors"
                      >
                        {post.author_name}
                      </Link>
                      {post.mentions.length > 0 && (
                        <span className="text-xs text-slate-400 md:text-slate-600">
                          <span className="text-slate-500 md:text-slate-500">is with </span>
                          <Link
                            to="/profile/$id"
                            params={{ id: post.mentions[0].slug ?? post.mentions[0].user_id }}
                            className="text-emerald-400 md:text-emerald-600 hover:underline font-medium"
                          >
                            {post.mentions[0].name}
                          </Link>
                          {post.mentions.length > 1 && (
                            <>
                              <span className="text-slate-500 md:text-slate-500"> and </span>
                              <button
                                type="button"
                                onClick={() => setMentionsSheet(post.mentions)}
                                className="text-emerald-400 md:text-emerald-600 hover:underline font-medium"
                              >
                                {Math.min(post.mentions.length - 1, 99)}
                                {post.mentions.length - 1 >= 99 ? "+" : ""} other
                                {post.mentions.length - 1 === 1 ? "" : "s"}
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 md:text-slate-500">{timeAgo(post.created_at)}</div>
                    {post.circle && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500 md:text-slate-500">Posted in</span>
                        <a
                          href={`/?section=Circles&circle=${encodeURIComponent(post.circle.slug)}`}
                          className="inline-flex items-center gap-1.5 text-emerald-300 md:text-emerald-700 font-semibold hover:underline"
                        >
                          {post.circle.avatarUrl ? (
                            <img
                              src={post.circle.avatarUrl}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <Users className="w-3 h-3" />
                          )}
                          {post.circle.name}
                        </a>
                        {!post.circle.viewerIsMember && (
                          <button
                            type="button"
                            onClick={() => handleJoinCircleFromFeed(post.circle!.id, post.circle!.slug)}
                            className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 md:text-emerald-700 text-[10px] font-bold hover:bg-emerald-500/25"
                          >
                            Join
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isReported ? (
                    <ReportedBadge details={reported.get(post.id)} />
                  ) : (
                    <div className="ml-auto flex items-center gap-1">
                      <PostActionsMenu
                        postId={post.id}
                        shareTitle={`${post.author_name} on Oventric`}
                        shareHref={shareHref}
                        onReport={() => openReport(post.id)}
                        isOwn={meId === post.author_id}
                        onDelete={() => handleDeletePost(post.id)}
                      />
                    </div>
                  )}
                </header>
                {isReported && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300 md:text-amber-600">
                    <Flag className="w-3 h-3" />
                    You reported this post. It's hidden from your feed pending review.
                  </div>
                )}
                <TruncatedText
                  text={post.text || ""}
                  lines={3}
                  className="text-slate-300 md:text-slate-700 text-sm leading-relaxed"
                />
                {post.media_type === "image" && post.media.length > 0 && (() => {
                  const imgs = post.media.filter((m) => m.type === "image").map((m) => m.url);
                  const count = imgs.length;
                  if (count === 0) return null;
                  const openAt = (idx: number) => setLightbox({ images: imgs, index: idx });
                  const layout = pickFeedMosaicLayout(post.id, count);
                  const displayed = imgs.slice(0, layout.displayedCount);
                  return (
                    <div className={`relative mt-3 ${layout.wrapperClass} rounded-lg overflow-hidden border border-white/10 md:border-slate-200`}>
                      {displayed.map((url, i) => {
                        const isLastTile = count > 4 && i === displayed.length - 1;
                        return (
                          <button
                            key={url + i}
                            type="button"
                            onClick={() => openAt(i)}
                            className={`relative block ${count === 1 ? "max-h-[520px]" : layout.isMosaic ? "min-h-0" : "aspect-square"} ${layout.tileClasses[i] ?? ""} w-full overflow-hidden`}
                            aria-label={`Open image ${i + 1} of ${count}`}
                          >
                            <FeedPostImage
                              src={url}
                              alt={`Post attachment ${i + 1}`}
                              className={`${count === 1 ? "max-h-[520px] w-full" : "absolute inset-0 w-full h-full"} object-cover`}
                            />
                            {isLastTile && count > 4 && (
                              <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xl font-semibold">
                                +{count - 4}
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {splash && splash.postId === post.id && (
                        <ReactionSplash reaction={splash.reaction} keyId={splash.id} />
                      )}
                      {post.viewer_reaction && (
                        <ReactionImageBadge reaction={post.viewer_reaction} />
                      )}
                    </div>
                  );
                })()}
                {post.media_url && post.media_type === "video" && (
                  <div className="relative mt-3">
                    <button
                      type="button"
                      onClick={() => setVideoStartId(post.id)}
                      className="relative block w-full aspect-video rounded-lg border border-white/10 md:border-slate-200 bg-black overflow-hidden group"
                      aria-label="Play video"
                    >
                      <video
                        src={`${post.media_url}#t=0.1`}
                        poster={post.poster_url ?? undefined}
                        preload={post.poster_url ? "none" : "metadata"}
                        muted
                        playsInline
                        disableRemotePlayback
                        // The uploaded poster is served instantly; the clip
                        // itself is only fetched when the user opens the reel.
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />

                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                        <div className="p-4 rounded-full bg-black/70 border border-white/25 backdrop-blur">
                          <Play className="w-8 h-8 text-white md:text-slate-900 fill-white" />
                        </div>
                      </div>
                    </button>
                    {splash && splash.postId === post.id && (
                      <ReactionSplash reaction={splash.reaction} keyId={splash.id} />
                    )}
                    {post.viewer_reaction && (
                      <ReactionImageBadge reaction={post.viewer_reaction} />
                    )}
                  </div>
                )}

                {/* Action bar */}
                <div className="relative flex items-center gap-1 mt-4 pt-3 border-t border-white/5 md:border-slate-200 text-slate-400 md:text-slate-600 text-xs">
                  <div className="relative flex items-center gap-2">
                    <ReactionButton
                      reaction={post.viewer_reaction ?? "love"}
                      size="sm"
                      ariaLabel="React"
                      onClick={() => {
                        if (post.viewer_reaction) {
                          handleReact(post, null);
                        } else {
                          setPickerFor((v) => (v === post.id ? null : post.id));
                        }
                      }}
                    />
                    <span
                      className="font-semibold"
                      style={{
                        color: post.viewer_reaction ? REACTION_META[post.viewer_reaction].color : undefined,
                      }}
                    >
                      {post.likes_count}
                    </span>
                    {pickerFor === post.id && (
                      <ReactionPicker
                        onPick={(r) => {
                          setPickerFor(null);
                          handleReact(post, r);
                        }}
                        onClose={() => setPickerFor(null)}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommentsSheetPostId(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 md:hover:bg-slate-100 hover:text-white md:hover:text-slate-900 transition-colors"
                    aria-label="Open comments"
                  >
                    <MessageSquare className="w-4 h-4" /> {post.comments_count}
                  </button>
                  <button
                    onClick={() => shareUrl(shareHref, `${post.author_name} on Oventric`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 md:hover:bg-slate-100 hover:text-white md:hover:text-slate-900 transition-colors ml-auto"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>

                {/* Comments preview: latest one, tap count → sheet */}
                <div className="mt-3">
                  {comments.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setCommentsSheetPostId(post.id)}
                      className="w-full rounded-lg border border-dashed border-white/10 md:border-slate-300 bg-black/20 md:bg-slate-50 px-3 py-3 text-left text-xs text-slate-500 hover:text-slate-300 md:hover:text-slate-700 hover:border-white/20 md:hover:border-slate-400 transition-colors"
                    >
                      No comments yet — be the first to reply.
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {(() => {
                        const latest = comments[comments.length - 1];
                        return (
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden bg-neutral-800 md:bg-slate-200 flex items-center justify-center text-white/85 md:text-slate-700">
                              <User className="w-4 h-4" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0 bg-black/30 md:bg-slate-100 border border-white/5 md:border-slate-200 rounded-lg px-3 py-2">
                              <div className="text-xs font-semibold text-white md:text-slate-900 truncate">
                                {latest.author}
                              </div>
                              <div className="text-xs text-slate-300 md:text-slate-700 mt-0.5 line-clamp-2 whitespace-pre-wrap break-words">
                                {latest.text}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => setCommentsSheetPostId(post.id)}
                        className="text-[11px] font-medium text-emerald-400 md:text-emerald-600 hover:text-emerald-300 md:hover:text-emerald-700 ml-9"
                      >
                        {post.comments_count > 1
                          ? `View all ${post.comments_count} comments`
                          : "Reply"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
            }
          })()
        )}
        {commentError && (
          <div className="text-[11px] text-red-400 md:text-red-600 -mt-2">{commentError}</div>
        )}

        {/* Mock marketplace, sponsored, and bounty cards removed — live data lives in the DiscoveryPanel and dedicated routes. */}


        <ShareSheet
          open={!!blogShare}
          onClose={() => setBlogShare(null)}
          url={blogShare ? `${typeof window !== "undefined" ? window.location.origin : ""}/blog/${blogShare.slug}` : ""}
          title={blogShare?.title ?? "Oventric Blog"}
          text={blogShare?.excerpt || undefined}
        />
        <ReportModal
          open={!!reportOpen}
          onClose={() => setReportOpen(null)}
          target={reportOpen?.startsWith("bounty") ? "bounty" : reportOpen?.startsWith("listing") ? "listing" : "post"}
          targetId={reportOpen ?? undefined}
          targetKind={reportOpen?.startsWith("bounty") ? "bounty" : reportOpen?.startsWith("listing") ? "listing" : "post"}
          onReported={markReported}
        />
      </div>
      <DiscoveryPanel />

      {lightbox && (
        <ImageLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
      {videoStartId && (() => {
        const videos = posts.filter((p) => p.media_type === "video" && p.media_url);
        if (!videos.some((v) => v.id === videoStartId)) return null;
        return (
          <VideoPlayerModal
            videos={videos}
            startId={videoStartId}
            onClose={() => setVideoStartId(null)}
            onReact={(postId, reaction) => {
              const p = posts.find((x) => x.id === postId);
              if (p) handleReact(p, reaction);
            }}
            onOpenComments={(postId) => setCommentsSheetPostId(postId)}
            onReport={(postId) => setReportOpen(postId)}
          />
        );
      })()}
      {commentsSheetPostId && (() => {
        const p = posts.find((x) => x.id === commentsSheetPostId);
        if (!p) return null;
        return (
          <CommentsSheet
            postId={p.id}
            postAuthorName={p.author_name}
            onClose={() => setCommentsSheetPostId(null)}
            viewerName="You"
            viewerInitials="OV"
          />
        );
      })()}
      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={() => { refreshPosts(); }}
      />
      {mentionsSheet && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMentionsSheet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 md:border-slate-200">
              <h3 className="text-white md:text-slate-900 font-semibold text-sm">Mentioned in this post</h3>
              <button
                type="button"
                onClick={() => setMentionsSheet(null)}
                className="text-slate-400 md:text-slate-600 hover:text-white md:hover:text-slate-900 text-sm"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/5 md:divide-slate-200">
              {mentionsSheet.map((m) => (
                <Link
                  key={m.user_id}
                  to="/profile/$id"
                  params={{ id: m.slug ?? m.user_id }}
                  onClick={() => setMentionsSheet(null)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 md:hover:bg-slate-100 transition-colors"
                >
                  <span className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 md:bg-slate-200 flex items-center justify-center text-white/85 md:text-slate-700 shrink-0">
                    <User className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <span className="text-white md:text-slate-900 text-sm truncate">{m.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
