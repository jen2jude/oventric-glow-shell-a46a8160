import { Paperclip, MessageSquare, Share2, Flag, Send, Pencil, Trash2, Check, X, RotateCcw, AlertCircle, Image as ImageIcon, Video as VideoIcon, Megaphone, ShieldAlert, Copyright, AlertTriangle, Play, BookOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { ReportModal } from "@/components/oventric/ReportModal";
import { useActiveAds } from "@/lib/admin/store";
import { AdCard } from "@/components/oventric/AdCard";
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
import {
  ReactionPicker,
  ReactionSplash,
  ReactionImageBadge,
  REACTION_META,
} from "@/components/oventric/feed/Reactions";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";
import { VideoPlayerModal } from "@/components/oventric/feed/VideoPlayerModal";
import { CommentsSheet } from "@/components/oventric/feed/CommentsSheet";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { PostActionsMenu, shareUrl, getHiddenPosts } from "@/components/oventric/PostActionsMenu";
import { listBlogPosts, type BlogListItem } from "@/lib/blog.functions";

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
  const feedAds = useActiveAds("feed");

  const [meId, setMeId] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [composerDraft, setComposerDraft] = useState("");
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

  // Current user id
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) setMeId(data.user.id);
    })();
  }, []);

  // Focus composer when the create panel dispatches a "post" action.
  useEffect(() => {
    const onCreate = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind !== "post") return;
      const el = document.getElementById("oventric-composer");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => composerRef.current?.focus(), 350);
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
              cacheControl: "3600",
              upsert: false,
            });
          if (upErr) throw upErr;
          mediaPath = path;
          mediaType = attachment.kind;
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
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [videoStartId, setVideoStartId] = useState<string | null>(null);
  const [commentsSheetPostId, setCommentsSheetPostId] = useState<string | null>(null);
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(() => getHiddenPosts());
  const [blogPosts, setBlogPosts] = useState<BlogListItem[]>([]);
  const listBlogFn = useServerFn(listBlogPosts);

  useEffect(() => {
    listBlogFn().then((r) => setBlogPosts(r.posts)).catch(() => {});
    const onUpdate = () => setHiddenPosts(getHiddenPosts());
    window.addEventListener("oventric:posts-updated", onUpdate);
    return () => window.removeEventListener("oventric:posts-updated", onUpdate);
  }, [listBlogFn]);

  const zeroCounts = (): Record<ReactionType, number> => ({ love: 0, like: 0, laugh: 0, crown: 0 });

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
    <div className="w-full max-w-7xl mx-auto px-4 py-6 lg:flex lg:flex-row lg:gap-6 lg:items-start lg:[scrollbar-gutter:stable]">
      <div className="w-full lg:flex-1 lg:min-w-0 flex flex-col space-y-4">
        {/* Composer */}
        <div id="oventric-composer" className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
          <textarea
            ref={composerRef}
            rows={2}
            value={composerDraft}
            onChange={(e) => setComposerDraft(e.target.value)}
            placeholder="What are you creating today? Seeking Technical Help?"
            className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none text-sm"
          />
          {attachment && (
            <div className="mt-3 relative inline-block max-w-full">
              {attachment.kind === "image" ? (
                <ResponsiveImage
                  src={attachment.previewUrl}
                  alt="Attachment preview"
                  className="max-h-64 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <video
                  src={attachment.previewUrl}
                  controls
                  className="max-h-64 rounded-lg border border-white/10"
                />
              )}
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 hover:bg-black text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                {attachment.kind === "image" ? <ImageIcon className="w-3 h-3" /> : <VideoIcon className="w-3 h-3" />}
                <span className="truncate max-w-[240px]">{attachment.file.name}</span>
                <span>· {(attachment.file.size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelected}
          />
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={posting}
              className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-sm transition-colors disabled:opacity-40"
            >
              <Paperclip className="w-4 h-4" />
              {attachment ? "Change attachment" : "Attach photo or video"}
            </button>
            <button
              onClick={handleCreatePost}
              disabled={!composerDraft.trim() || posting}
              className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-sm rounded-lg transition-colors"
            >
              {posting ? (attachment ? "Uploading…" : "Posting…") : "Post"}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Images or short videos, up to 50 MB.</p>
          {postError && <div className="mt-2 text-[11px] text-red-400">{postError}</div>}
        </div>


        {feedAds.map((a) => (
          <AdCard key={a.id} ad={a} variant="banner" />
        ))}

        {/* Posts (live) */}
        {postsLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading feed">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-white/[0.06] rounded" />
                    <div className="h-2 w-1/5 bg-white/[0.05] rounded" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-11/12 bg-white/[0.06] rounded" />
                  <div className="h-3 w-4/5 bg-white/[0.06] rounded" />
                  <div className="h-3 w-2/3 bg-white/[0.05] rounded" />
                </div>
                <div className="h-40 w-full bg-white/[0.04] rounded-lg mb-4" />
                <div className="flex gap-6">
                  <div className="h-3 w-10 bg-white/[0.05] rounded" />
                  <div className="h-3 w-10 bg-white/[0.05] rounded" />
                  <div className="h-3 w-10 bg-white/[0.05] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : postsError ? (
          <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-6 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-300">Couldn’t load the feed</p>
            <p className="mt-1 text-xs text-red-300/80">{postsError}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">The feed is quiet right now</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
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
                  <Link
                    key={`blog-${b.id}`}
                    to="/blog/$slug"
                    params={{ slug: b.slug }}
                    className="block bg-gradient-to-br from-[#1E1E24] to-[#191921] border border-emerald-500/30 rounded-xl overflow-hidden hover:border-emerald-500/60 transition"
                  >
                    {b.cover_url && (
                      <ResponsiveImage src={b.cover_url} alt={b.title} className="w-full aspect-[16/7] object-cover" />
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                          Blog{b.category_name ? ` · ${b.category_name}` : ""}
                        </span>
                      </div>
                      <h3 className="text-white text-lg font-black leading-tight">{b.title}</h3>
                      <p className="mt-1.5 text-sm text-slate-400 line-clamp-3">{b.excerpt}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">By {b.author_name}</span>
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold">
                          Read article →
                        </span>
                      </div>
                    </div>
                  </Link>,
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
                className={`bg-[#1E1E24] border border-white/10 rounded-xl p-5 transition-opacity ${isReported ? "opacity-70" : ""}`}
              >
                <header className="flex items-center gap-3 mb-3">
                  <Link
                    to="/profile/$id"
                    params={{ id: profileSlug }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0 hover:ring-2 hover:ring-emerald-400/60 transition"
                  >
                    {post.initials}
                  </Link>
                  <div className="min-w-0">
                    <Link
                      to="/profile/$id"
                      params={{ id: profileSlug }}
                      className="font-semibold text-white text-sm hover:text-emerald-400 transition-colors"
                    >
                      {post.author_name}
                    </Link>
                    <div className="text-xs text-slate-500">{timeAgo(post.created_at)}</div>
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
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
                    <Flag className="w-3 h-3" />
                    You reported this post. It's hidden from your feed pending review.
                  </div>
                )}
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {post.text}
                </p>
                {post.media_url && post.media_type === "image" && (
                  <div className="relative mt-3">
                    <button
                      type="button"
                      onClick={() => setLightbox(post.media_url!)}
                      className="block w-full"
                      aria-label="Open image"
                    >
                      <ResponsiveImage
                        src={post.media_url}
                        alt="Post attachment"
                        loading="lazy"
                        className="max-h-[520px] w-full rounded-lg border border-white/10 object-cover"
                      />
                    </button>
                    {splash && splash.postId === post.id && (
                      <ReactionSplash reaction={splash.reaction} keyId={splash.id} />
                    )}
                    {post.viewer_reaction && (
                      <ReactionImageBadge reaction={post.viewer_reaction} />
                    )}
                  </div>
                )}
                {post.media_url && post.media_type === "video" && (
                  <div className="relative mt-3">
                    <button
                      type="button"
                      onClick={() => setVideoStartId(post.id)}
                      className="relative block w-full aspect-video rounded-lg border border-white/10 bg-black overflow-hidden group"
                      aria-label="Play video"
                    >
                      <video
                        src={post.media_url}
                        preload="metadata"
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                        <div className="p-4 rounded-full bg-black/70 border border-white/25 backdrop-blur">
                          <Play className="w-8 h-8 text-white fill-white" />
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
                <div className="relative flex items-center gap-1 mt-4 pt-3 border-t border-white/5 text-slate-400 text-xs">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (post.viewer_reaction) {
                          handleReact(post, null);
                        } else {
                          setPickerFor((v) => (v === post.id ? null : post.id));
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      style={{
                        color: post.viewer_reaction ? REACTION_META[post.viewer_reaction].color : undefined,
                      }}
                      aria-pressed={post.viewer_liked}
                      aria-label="React"
                    >
                      {(() => {
                        const key: ReactionType = post.viewer_reaction ?? "love";
                        const Icon = REACTION_META[key].Icon;
                        return (
                          <Icon
                            className={`w-4 h-4 ${post.viewer_reaction ? "fill-current" : ""}`}
                          />
                        );
                      })()}
                      <span>{post.likes_count}</span>
                    </button>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors"
                    aria-label="Open comments"
                  >
                    <MessageSquare className="w-4 h-4" /> {post.comments_count}
                  </button>
                  <button
                    onClick={() => shareUrl(shareHref, `${post.author_name} on Oventric`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors ml-auto"
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
                      className="w-full rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-3 text-left text-xs text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors"
                    >
                      No comments yet — be the first to reply.
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {(() => {
                        const latest = comments[comments.length - 1];
                        return (
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black text-[10px] font-bold">
                              {latest.initials}
                            </div>
                            <div className="flex-1 min-w-0 bg-black/30 border border-white/5 rounded-lg px-3 py-2">
                              <div className="text-xs font-semibold text-white truncate">
                                {latest.author}
                              </div>
                              <div className="text-xs text-slate-300 mt-0.5 line-clamp-2 whitespace-pre-wrap break-words">
                                {latest.text}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => setCommentsSheetPostId(post.id)}
                        className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 ml-9"
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
          <div className="text-[11px] text-red-400 -mt-2">{commentError}</div>
        )}

        {/* Mock marketplace, sponsored, and bounty cards removed — live data lives in the DiscoveryPanel and dedicated routes. */}


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
        <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
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
    </div>
  );
}
