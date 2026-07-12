import { useEffect, useRef, useState } from "react";
import { X, MessageCircle, Pin, MoreHorizontal, Play, Share2, Bookmark, Flag } from "lucide-react";
import { ReactionPicker, ReactionSplash, REACTION_META } from "./Reactions";
import type { FeedPost, ReactionType } from "@/lib/posts.functions";

interface Props {
  videos: FeedPost[];
  startId: string;
  onClose: () => void;
  onReact: (postId: string, reaction: ReactionType | null) => void;
  onOpenComments: (postId: string) => void;
  onPin?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onSave?: (postId: string) => void;
}

function VideoItem({
  post,
  active,
  onReact,
  onOpenComments,
  onPin,
  onReport,
  onShare,
  onSave,
}: {
  post: FeedPost;
  active: boolean;
} & Omit<Props, "videos" | "startId" | "onClose">) {
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
      v.play().then(() => setPaused(false)).catch(() => setPaused(true));
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
        src={post.media_url ?? undefined}
        className="max-h-full max-w-full object-contain"
        loop
        playsInline
        onClick={() => {
          const v = vRef.current;
          if (!v) return;
          if (v.paused) {
            v.play(); setPaused(false);
          } else {
            v.pause(); setPaused(true);
          }
        }}
      />
      {paused && (
        <button
          onClick={() => { vRef.current?.play(); setPaused(false); }}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <div className="p-5 rounded-full bg-black/60 border border-white/20">
            <Play className="w-10 h-10 text-white fill-white" />
          </div>
        </button>
      )}

      {splash && <ReactionSplash reaction={splash.r} keyId={splash.id} />}

      {/* Caption */}
      <div className="absolute left-3 right-20 bottom-6 z-10">
        <div className="text-[13px] font-semibold text-white/95">@{post.author_slug ?? post.author_name}</div>
        <div className="text-[12px] text-white/85 line-clamp-3 mt-0.5">{post.text}</div>
      </div>

      {/* Side actions */}
      <div className="absolute right-2 bottom-8 z-10 flex flex-col items-center gap-4">
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={() => (viewer ? doReact(null) : setPickerOpen((v) => !v))}
            className="p-3 rounded-full bg-black/50 border border-white/20 backdrop-blur"
            style={{ color: viewer ? REACTION_META[viewer].color : "#fff" }}
            aria-label="React"
          >
            {(() => {
              const Icon = viewer ? REACTION_META[viewer].Icon : REACTION_META.love.Icon;
              return <Icon className={`w-6 h-6 ${viewer ? "fill-current" : ""}`} />;
            })()}
          </button>
          <span className="text-[11px] text-white/90 mt-1">{post.likes_count}</span>
          {pickerOpen && (
            <ReactionPicker
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
          onClick={() => onPin?.(post.id)}
          className="p-3 rounded-full bg-black/50 border border-white/20 text-white"
          aria-label="Pin"
        >
          <Pin className="w-6 h-6" />
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
            <div className="absolute right-0 bottom-full mb-2 min-w-[10rem] rounded-xl bg-[#1a1a1e] border border-white/15 shadow-xl py-1 text-[13px] text-slate-100">
              <button className="w-full px-3 py-2 hover:bg-white/5 flex items-center gap-2" onClick={() => { setMenuOpen(false); onSave?.(post.id); }}>
                <Bookmark className="w-4 h-4" /> Save
              </button>
              <button className="w-full px-3 py-2 hover:bg-white/5 flex items-center gap-2" onClick={() => { setMenuOpen(false); onShare?.(post.id); }}>
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button className="w-full px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-rose-300" onClick={() => { setMenuOpen(false); onReport?.(post.id); }}>
                <Flag className="w-4 h-4" /> Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VideoPlayerModal({ videos, startId, onClose, onReact, onOpenComments, onPin, onReport, onShare, onSave }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState(startId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // Scroll to start video on mount
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-video-id="${startId}"]`);
    el?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
  }, [startId]);

  // Track which item is currently in view
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
  }, [videos.length]);

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
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory"
      >
        {videos.map((v) => (
          <div key={v.id} data-video-id={v.id} className="w-full h-[100dvh]">
            <VideoItem
              post={v}
              active={v.id === activeId}
              onReact={onReact}
              onOpenComments={onOpenComments}
              onPin={onPin}
              onReport={onReport}
              onShare={onShare}
              onSave={onSave}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
