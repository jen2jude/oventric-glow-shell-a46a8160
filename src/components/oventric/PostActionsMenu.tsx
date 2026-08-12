import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  EyeOff,
  Bookmark,
  Share2,
  Flag,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

type Action = "interested" | "not_interested" | "hide" | "save" | "share" | "report" | "copy_link";

export function shareUrl(url: string, title = "Oventric") {
  return (async () => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  })();
}

const LS = {
  saved: "oventric.saved_posts",
  hidden: "oventric.hidden_posts",
  interested: "oventric.interested_posts",
};

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}
function writeSet(key: string, s: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore */
  }
}

export function togglePostSet(kind: "saved" | "hidden" | "interested", id: string, on: boolean) {
  const key = LS[kind];
  const s = readSet(key);
  if (on) s.add(id);
  else s.delete(id);
  writeSet(key, s);
  window.dispatchEvent(new CustomEvent("oventric:posts-updated"));
}

export function getHiddenPosts(): Set<string> {
  return readSet(LS.hidden);
}
export function getSavedPosts(): Set<string> {
  return readSet(LS.saved);
}

export function PostActionsMenu({
  postId,
  shareTitle,
  shareHref,
  onReport,
  isOwn = false,
  onDelete,
}: {
  postId: string;
  shareTitle: string;
  shareHref: string;
  onReport: () => void;
  isOwn?: boolean;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const run = (a: Action) => {
    setOpen(false);
    switch (a) {
      case "interested":
        togglePostSet("interested", postId, true);
        toast.success("Got it — we'll show more like this.");
        break;
      case "not_interested":
        togglePostSet("interested", postId, false);
        togglePostSet("hidden", postId, true);
        toast.success("Thanks — we'll show less like this.");
        break;
      case "hide":
        togglePostSet("hidden", postId, true);
        toast.success("Post hidden from your feed.");
        break;
      case "save":
        togglePostSet("saved", postId, true);
        toast.success("Saved to your bookmarks.");
        break;
      case "share":
        void shareUrl(shareHref, shareTitle);
        break;
      case "copy_link":
        navigator.clipboard.writeText(shareHref).then(() => toast.success("Link copied"));
        break;
      case "report":
        onReport();
        break;
    }
  };

  const item = (icon: React.ElementType, label: string, action: Action, danger?: boolean) => {
    const Icon = icon;
    return (
      <button
        onClick={() => run(action)}
        className={`w-full flex items-center gap-2.5 px-3 py-3 text-left text-sm rounded-[10px] ${
          danger ? "text-red-300 hover:bg-red-500/10" : "text-slate-200 hover:bg-white/5"
        }`}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-[10px] text-slate-500 md:text-slate-500 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:hover:bg-slate-100 transition-colors"
        aria-label="More"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-xl bg-[#1a1a20] md:bg-white md:shadow-lg border border-white/10 md:border-slate-200 shadow-2xl p-1">
          {item(ThumbsUp, "Interested", "interested")}
          {item(ThumbsDown, "Not interested", "not_interested")}
          {item(EyeOff, "Hide post", "hide")}
          {item(Bookmark, "Save post", "save")}
          {item(Share2, "Share", "share")}
          {item(Link2, "Copy link", "copy_link")}
          <div className="h-px bg-white/5 md:bg-slate-100 my-1" />
          {item(Flag, "Report", "report", true)}
          {isOwn && onDelete && (
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-3 text-left text-sm text-red-300 md:text-red-600 hover:bg-red-500/10 rounded-[10px]"
            >
              <Flag className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
