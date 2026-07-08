import { Paperclip, Heart, MessageSquare, Share2, Sparkles, Target, Users, ShoppingCart, Flag, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  toggleLike as toggleLikeFn,
  type FeedPost,
} from "@/lib/posts.functions";

interface Comment {
  id: string;
  postId: string;
  author: string;
  authorId: string;
  initials: string;
  text: string;
}

function toComment(c: FeedComment): Comment {
  return {
    id: c.id,
    postId: c.post_id,
    author: c.author_name,
    authorId: c.author_id,
    initials: c.initials,
    text: c.text,
  };
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
  reasonLabel: string;
  note: string | null;
}

function ReportedBadge({ details }: { details?: ReportDetails }) {
  const tooltip = details
    ? `Reason: ${details.reasonLabel}${details.note ? `\nNote: ${details.note}` : "\nNote: (none)"}`
    : "You reported this post";
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 cursor-help"
    >
      <Flag className="w-3 h-3" /> Reported
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

  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({});
  const [commentError, setCommentError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reported, setReported] = useState<Map<string, ReportDetails>>(() => {
    if (typeof window === "undefined") return new Map();
    try {
      const raw = window.localStorage.getItem("oventric.reported");
      if (!raw) return new Map();
      return new Map(Object.entries(JSON.parse(raw) as Record<string, ReportDetails>));
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
      next.set(id, { reasonLabel: details.reasonLabel, note: details.note });
      return next;
    });
  const openReport = (id: string) => {
    if (reported.has(id)) return;
    setReportOpen(id);
  };

  const listPosts = useServerFn(listPostsFn);
  const createPost = useServerFn(createPostFn);
  const deletePost = useServerFn(deletePostFn);
  const toggleLike = useServerFn(toggleLikeFn);
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
          setCommentsByPost((prev) => {
            const arr = prev[row.post_id] ?? [];
            if (arr.some((c) => c.id === row.id)) return prev;
            return { ...prev, [row.post_id]: [...arr, toComment(row)] };
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
            return { ...prev, [row.post_id]: arr.map((c) => (c.id === row.id ? toComment(row) : c)) };
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

  const handleCreatePost = () => {
    const text = composerDraft.trim();
    if (!text || posting) return;
    require(1, async () => {
      setPosting(true);
      setPostError(null);
      try {
        await createPost({ data: { text } });
        setComposerDraft("");
        // realtime will refresh; nudge in case the channel is late
        refreshPosts();
      } catch (e) {
        console.error(e);
        setPostError("Couldn't publish post. Try again.");
      } finally {
        setPosting(false);
      }
    });
  };

  const handleLike = (post: FeedPost) => {
    require(1, async () => {
      const nextLiked = !post.viewer_liked;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                viewer_liked: nextLiked,
                likes_count: Math.max(0, p.likes_count + (nextLiked ? 1 : -1)),
              }
            : p,
        ),
      );
      try {
        await toggleLike({ data: { postId: post.id, like: nextLiked } });
      } catch (e) {
        console.error(e);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, viewer_liked: post.viewer_liked, likes_count: post.likes_count }
              : p,
          ),
        );
      }
    });
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

  const submitComment = (postId: string) => {
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text || commentPosting[postId]) return;
    require(1, async () => {
      setCommentDrafts((d) => ({ ...d, [postId]: "" }));
      setCommentPosting((p) => ({ ...p, [postId]: true }));
      setCommentError(null);
      try {
        await addComment({
          data: { postId, text, authorName: "You", initials: "OV" },
        });
      } catch (e) {
        console.error(e);
        setCommentDrafts((d) => ({ ...d, [postId]: text }));
        setCommentError("Couldn't post comment. Try again.");
      } finally {
        setCommentPosting((p) => ({ ...p, [postId]: false }));
      }
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

  const handleBuy = () => require(2, () => alert("Proceeding to checkout (mock)"));
  const handleBounty = () => require(2, () => alert("Applying to bounty (mock)"));
  const isLoggedIn = tier >= 1;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 lg:flex lg:flex-row lg:gap-6 lg:items-start">
      <div className="w-full lg:w-[62%] flex flex-col space-y-4 min-w-0">
        {/* Composer */}
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
          <textarea
            rows={2}
            value={composerDraft}
            onChange={(e) => setComposerDraft(e.target.value)}
            placeholder="What are you creating today? Seeking Technical Help?"
            className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none text-sm"
          />
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <button className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-sm transition-colors">
              <Paperclip className="w-4 h-4" />
              Attach
            </button>
            <button
              onClick={handleCreatePost}
              disabled={!composerDraft.trim() || posting}
              className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-sm rounded-lg transition-colors"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
          {postError && <div className="mt-2 text-[11px] text-red-400">{postError}</div>}
        </div>

        {feedAds.map((a) => (
          <AdCard key={a.id} ad={a} variant="banner" />
        ))}

        {/* Posts (live) */}
        {postsLoading ? (
          <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-6 text-sm text-slate-400 text-center">
            Loading feed…
          </div>
        ) : postsError ? (
          <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-6 text-sm text-red-300 text-center">
            {postsError}
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-6 text-sm text-slate-400 text-center">
            No posts yet. Be the first to share something.
          </div>
        ) : (
          posts.map((post) => {
            const comments = commentsByPost[post.id] ?? [];
            const isReported = reported.has(post.id);
            const profileSlug = post.author_slug ?? post.author_id;
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
                      {meId === post.author_id && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                          aria-label="Delete post"
                          title="Delete post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openReport(post.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                        aria-label="Report post"
                        title="Report post"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
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
                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/5 text-slate-400 text-xs">
                  <button
                    onClick={() => handleLike(post)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors ${post.viewer_liked ? "text-emerald-400" : "hover:text-emerald-400"}`}
                    aria-pressed={post.viewer_liked}
                  >
                    <Heart className={`w-4 h-4 ${post.viewer_liked ? "fill-current" : ""}`} /> {post.likes_count}
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors">
                    <MessageSquare className="w-4 h-4" /> {post.comments_count}
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors ml-auto">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>

                {/* Comments */}
                <div className="mt-4 space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Link
                        to="/profile/$id"
                        params={{ id: c.authorId }}
                        className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black text-[10px] font-bold"
                      >
                        {c.initials}
                      </Link>
                      <div className="group flex-1 bg-black/30 border border-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/profile/$id"
                            params={{ id: c.authorId }}
                            className="text-xs font-semibold text-white hover:text-emerald-400"
                          >
                            {c.author}
                          </Link>
                          {meId && c.authorId === meId && editing?.id !== c.id && (
                            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => startEdit(c)}
                                aria-label="Edit comment"
                                className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-emerald-400"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeComment(c.id)}
                                aria-label="Delete comment"
                                className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {editing?.id === c.id ? (
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              value={editing.text}
                              onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                else if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              className="flex-1 bg-black/40 border border-emerald-500/40 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={savingEdit || !editing.text.trim() || editing.text.trim() === c.text}
                              aria-label="Save edit"
                              className="p-1 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              aria-label="Cancel edit"
                              className="p-1 rounded hover:bg-white/5 text-slate-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-300 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                            {c.text}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline comment input */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black text-[10px] font-bold">
                    OV
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg pl-3 pr-1 py-1 focus-within:border-emerald-500/60 transition-colors">
                    <input
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && submitComment(post.id)}
                      placeholder={isLoggedIn ? "Write a comment…" : "Sign in to comment"}
                      className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      onClick={() => submitComment(post.id)}
                      disabled={!(commentDrafts[post.id] ?? "").trim() || !!commentPosting[post.id]}
                      className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black"
                      aria-label="Send comment"
                    >
                      <Send className={`w-3.5 h-3.5 ${commentPosting[post.id] ? "animate-pulse" : ""}`} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
        {commentError && (
          <div className="text-[11px] text-red-400 -mt-2">{commentError}</div>
        )}

        {/* Marketplace asset (mock) */}
        <article className="bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden">
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <Link to="/profile/$id" params={{ id: "aria-kessler" }} className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-xs">
                KL
              </div>
              <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">Kessler Labs</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Marketplace</span>
              {reported.has("listing-rls-kit") ? (
                <ReportedBadge details={reported.get("listing-rls-kit")} />
              ) : (
                <button
                  onClick={() => openReport("listing-rls-kit")}
                  className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5"
                  aria-label="Report listing"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </header>
          <div className="p-5">
            <h3 className="font-semibold text-white text-base mb-1">Postgres RLS Starter Kit</h3>
            <p className="text-sm text-slate-400 mb-4">
              Production-grade row-level security scaffolding with role enums, security-definer helpers, and typed policies.
            </p>
            <div className="flex items-center justify-between">
              <div className="text-white font-black text-xl">$49</div>
              <button
                onClick={handleBuy}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
              >
                <ShoppingCart className="w-4 h-4" /> Buy Now
              </button>
            </div>
          </div>
        </article>

        {/* Sponsored native ad (mock) */}
        <article className="bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden">
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">Nebula Cloud</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sponsored</span>
          </header>
          <div className="relative h-40 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: "radial-gradient(circle at 20% 30%, #10b981 0%, transparent 40%), radial-gradient(circle at 80% 70%, #6366f1 0%, transparent 40%)"
            }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/90 text-2xl font-black tracking-tight">DEPLOY IN 30s</span>
            </div>
          </div>
          <div className="p-5">
            <h3 className="font-semibold text-white text-base mb-1">Ship globally with edge-native infra</h3>
            <p className="text-sm text-slate-400 mb-4">
              Nebula Cloud gives you sub-50ms cold starts across 40 regions. Free tier includes 10M requests/mo.
            </p>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors">
              Learn More
            </button>
          </div>
        </article>

        {/* Bounty (mock) */}
        <article className={`relative bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-5 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] transition-opacity ${reported.has("bounty-rls") ? "opacity-70" : ""}`}>
          <div className="flex items-start justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold tracking-wide mb-3">
              <Target className="w-3 h-3" />
              [ACTIVE BOUNTY: $450 USD]
            </div>
            {reported.has("bounty-rls") ? (
              <ReportedBadge details={reported.get("bounty-rls")} />
            ) : (
              <button
                onClick={() => openReport("bounty-rls")}
                className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5"
                aria-label="Report bounty"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to="/profile/$id"
              params={{ id: "marco-tenreiro" }}
              className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-[10px] font-bold"
            >
              MT
            </Link>
            <Link
              to="/profile/$id"
              params={{ id: "marco-tenreiro" }}
              className="text-xs text-slate-400 hover:text-emerald-400"
            >
              Marco Tenreiro
            </Link>
          </div>
          <h3 className="text-white font-bold text-lg leading-snug mb-2">
            Need a clean custom user-roles matrix built for a Supabase backend
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Looking for RLS-first design with an enum-driven role table and a <code className="text-emerald-300 text-xs bg-black/30 px-1 rounded">has_role</code> security-definer function.
          </p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 12 applicants</span>
              <span>· Closes in 3 days</span>
            </div>
            <button
              onClick={handleBounty}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
            >
              Solve &amp; Earn
            </button>
          </div>
        </article>

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
    </div>
  );
}
