import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  MessageCircle,
  Pin,
  MoreHorizontal,
  Play,
  Share2,
  Bookmark,
  Flag,
  ThumbsUp,
  ThumbsDown,
  EyeOff,
  Download,
  Link2,
} from "lucide-react";
import { ReactionPicker, ReactionSplash, ReactionButton, REACTION_META } from "./Reactions";
import { togglePostSet } from "@/components/oventric/PostActionsMenu";
import { toast } from "sonner";
import type { FeedPost, ReactionType } from "@/lib/posts.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";

const PIN_KEY = "oventric:pinned_videos";
const HIDE_KEY = "oventric:hidden_videos";
const INTEREST_KEY = "oventric:video_interest"; // { [postId]: 1 | -1 }

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}
function writeSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(s)));
  } catch {}
}
function readMap(key: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
function writeMap(key: string, m: Record<string, number>) {
  try {
    localStorage.setItem(key, JSON.stringify(m));
  } catch {}
}

interface Props {
  videos: FeedPost[];
  startId: string;
  onClose: () => void;
  onReact: (postId: string, reaction: ReactionType | null) => void;
  onOpenComments: (postId: string) => void;
  onReport?: (postId: string) => void;
}

async function downloadVideo(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
  } catch {
    window.open(url, "_blank");
  }
}

async function shareVideo(post: FeedPost) {
  const url = post.media_url ?? window.location.href;
  const shareData = { title: `@${post.author_slug ?? post.author_name}`, text: post.text, url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      /* cancelled */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard");
  } catch {
    /* ignore */
  }
}

function VideoItem({
  post,
  active,
  preload,
  pinned,
  onReact,
  onOpenComments,
  onTogglePin,
  onReport,
  onInterest,
  onHide,
}: {
  post: FeedPost;
  preload: boolean;
  active: boolean;
  pinned: boolean;
  onReact: (postId: string, reaction: ReactionType | null) => void;
  onOpenComments: (postId: string) => void;
  onTogglePin: (postId: string) => void;
  onReport?: (postId: string) => void;
  onInterest: (postId: string, value: 1 | -1) => void;
  onHide: (postId: string) => void;
}) {
  const vRef = useRef<HTMLVideoElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [splash, setSplash] = useState<{ id: number; r: ReactionType } | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play()
        .then(() => setPaused(false))
        .catch(() => setPaused(true));
    } else {
      v.pause();
    }
  }, [active]);

  const doReact = (r: ReactionType | null) => {
    if (r) {
      setSplash({ id: Date.now(), r });
      setTimeout(() => setSplash(null), 900);
    }
    onReact(post.id, r);
  };

  const viewer = post.viewer_reaction;

  return (
    <div className="relative w-full h-full snap-start flex items-center justify-center bg-black">
      <video
        ref={vRef}
        src={post.media_url ? `${post.media_url}#t=0.1` : undefined}
        poster={post.poster_url ?? undefined}
        className="max-h-full max-w-full object-contain"
        loop
        playsInline
        muted={false}
        preload={active || preload ? "auto" : "none"}
        disableRemotePlayback
        onClick={() => {
          const v = vRef.current;
          if (!v) return;
          if (v.paused) {
            v.play();
            setPaused(false);
          } else {
            v.pause();
            setPaused(true);
          }
        }}
      />

      {paused && (
        <button
          onClick={() => {
            vRef.current?.play();
            setPaused(false);
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <div className="p-5 rounded-full bg-black/60 border border-white/20">
            <Play className="w-10 h-10 text-white fill-white" />
          </div>
        </button>
      )}

      {splash && <ReactionSplash reaction={splash.r} keyId={splash.id} />}

      {/* Caption with avatar */}
      <div className="absolute left-3 right-20 bottom-6 z-10 flex items-start gap-2">
        {post.author_avatar_url ? (
          <ResponsiveImage
            src={post.author_avatar_url}
            alt={post.author_name}
            sizes="36px"
            className="w-9 h-9 rounded-full object-cover border border-white/30 shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#E5484D]/20 border border-[#E5484D]/40 flex items-center justify-center text-[11px] font-semibold text-emerald-300 shrink-0">
            {post.initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white/95">
            @{post.author_slug ?? post.author_name}
          </div>
          <div className="text-[12px] text-white/85 line-clamp-3 mt-0.5">{post.text}</div>
        </div>
      </div>

      {/* Side actions */}
      <div className="absolute right-2 bottom-8 z-10 flex flex-col items-center gap-4">
        <div className="relative flex flex-col items-center">
          <ReactionButton
            reaction={viewer ?? "love"}
            size="md"
            ariaLabel="React"
            onClick={() => (viewer ? doReact(null) : setPickerOpen((v) => !v))}
          />
          <span
            className="text-[11px] font-semibold text-white/90 mt-1"
            style={{ color: viewer ? REACTION_META[viewer].color : undefined }}
          >
            {post.likes_count}
          </span>
          {pickerOpen && (
            <ReactionPicker
              align="right"
              onPick={(r) => {
                setPickerOpen(false);
                doReact(r);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenComments(post.id)}
          className="p-3 rounded-full bg-black/50 border border-white/20 text-white flex flex-col items-center"
          aria-label="Comments"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
        <span className="text-[11px] text-white/90 -mt-3">{post.comments_count}</span>
        <button
          type="button"
          onClick={() => onTogglePin(post.id)}
          className={`p-3 rounded-full bg-black/50 border backdrop-blur transition-colors ${
            pinned ? "border-[#E5484D] text-emerald-300" : "border-white/20 text-white"
          }`}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          <Pin className={`w-6 h-6 ${pinned ? "fill-current" : ""}`} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-3 rounded-full bg-black/50 border border-white/20 text-white"
            aria-label="More"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-2 min-w-[11rem] rounded-xl bg-[#1a1a1e] border border-white/15 shadow-xl py-1 text-[13px] text-slate-100">
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  onInterest(post.id, 1);
                }}
              >
                <ThumbsUp className="w-4 h-4" /> Interested
              </button>
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  onInterest(post.id, -1);
                }}
              >
                <ThumbsDown className="w-4 h-4" /> Not interested
              </button>
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  onHide(post.id);
                }}
              >
                <EyeOff className="w-4 h-4" /> Hide reel
              </button>
              <div className="my-1 h-px bg-white/10" />
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  togglePostSet("saved", post.id, true);
                  toast.success("Saved to your bookmarks.");
                }}
              >
                <Bookmark className="w-4 h-4" /> Save
              </button>
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  if (post.media_url) downloadVideo(post.media_url, `oventric-${post.id}.mp4`);
                }}
              >
                <Download className="w-4 h-4" /> Download
              </button>
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  shareVideo(post);
                }}
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  const url = post.media_url ?? window.location.href;
                  navigator.clipboard.writeText(url).then(
                    () => toast.success("Link copied"),
                    () => toast.error("Could not copy link"),
                  );
                }}
              >
                <Link2 className="w-4 h-4" /> Copy link
              </button>
              <button
                className="w-full px-3 py-3 hover:bg-white/5 flex items-center gap-2 text-rose-300"
                onClick={() => {
                  setMenuOpen(false);
                  onReport?.(post.id);
                }}
              >
                <Flag className="w-4 h-4" /> Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VideoPlayerModal({
  videos,
  startId,
  onClose,
  onReact,
  onOpenComments,
  onReport,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState(startId);
  const [pinned, setPinned] = useState<Set<string>>(() => readSet(PIN_KEY));
  const [hidden, setHidden] = useState<Set<string>>(() => readSet(HIDE_KEY));
  const [interest, setInterest] = useState<Record<string, number>>(() => readMap(INTEREST_KEY));

  // Build ordered list: start video first, pinned videos next, then remaining (interest weighted, hidden excluded).
  const ordered = useMemo(() => {
    const visible = videos.filter((v) => !hidden.has(v.id) || v.id === startId);
    const start = visible.find((v) => v.id === startId);
    const rest = visible.filter((v) => v.id !== startId);
    const pinnedOrdered = rest.filter((v) => pinned.has(v.id));
    const others = rest
      .filter((v) => !pinned.has(v.id))
      .sort((a, b) => (interest[b.id] ?? 0) - (interest[a.id] ?? 0));
    return start ? [start, ...pinnedOrdered, ...others] : [...pinnedOrdered, ...others];
  }, [videos, pinned, hidden, interest, startId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-video-id="${startId}"]`);
    el?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
  }, [startId]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.55) {
            const id = (e.target as HTMLElement).dataset.videoId;
            if (id) setActiveId(id);
          }
        }
      },
      { root, threshold: [0.55, 0.8] },
    );
    root.querySelectorAll<HTMLElement>("[data-video-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ordered.length]);

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(PIN_KEY, next);
      return next;
    });
  };
  const hideVideo = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSet(HIDE_KEY, next);
      return next;
    });
  };
  const markInterest = (id: string, v: 1 | -1) => {
    setInterest((prev) => {
      const next = { ...prev, [id]: v };
      writeMap(INTEREST_KEY, next);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[105] bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 left-3 z-20 p-2 rounded-full bg-black/60 border border-white/20 text-white"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <div ref={scrollRef} className="h-full w-full overflow-y-auto snap-y snap-mandatory">
        {ordered.map((v, i) => {
          const activeIdx = ordered.findIndex((o) => o.id === activeId);
          const dist = Math.abs(i - activeIdx);
          return (
            <div key={v.id} data-video-id={v.id} className="w-full h-[100dvh]">
              <VideoItem
                post={v}
                active={v.id === activeId}
                preload={dist <= 2}
                pinned={pinned.has(v.id)}
                onReact={onReact}
                onOpenComments={onOpenComments}
                onTogglePin={togglePin}
                onReport={onReport}
                onInterest={markInterest}
                onHide={hideVideo}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
