import { useEffect } from "react";
import { X, Copy, Share2, Mail, Link2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  text?: string;
  /** Fired when the user actually shares through a channel (for logging). */
  onShared?: (channel: string) => void;
};

export async function nativeShare(url: string, title = "Oventric", text?: string) {
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title, text, url });
      return true;
    }
  } catch {
    /* cancelled */
  }
  return false;
}

export function ShareSheet({ open, onClose, url, title = "Oventric", text, onShared }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const enc = encodeURIComponent;
  const shareTargets = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
      bg: "bg-black",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      bg: "bg-[#1877F2]",
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      bg: "bg-[#0A66C2]",
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
      bg: "bg-[#25D366]",
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
      bg: "bg-[#229ED9]",
    },
    {
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`,
      bg: "bg-[#FF4500]",
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onShared?.("copy_link");
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const doNative = async () => {
    const ok = await nativeShare(url, title, text);
    if (ok) {
      onShared?.("native");
      onClose();
    }
  };

  const canNative = typeof navigator !== "undefined" && !!(navigator as any).share;

  return (
    <div
      className="modal-light fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#141418] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[10px] hover:bg-white/5 text-slate-400"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3 line-clamp-1">{title}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {shareTargets.map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${t.bg} text-white text-xs font-bold rounded-[10px] py-3 text-center hover:opacity-90 transition`}
              onClick={() => {
                onShared?.(t.label.toLowerCase());
                setTimeout(onClose, 100);
              }}
            >
              {t.label}
            </a>
          ))}
          <a
            href={`mailto:?subject=${enc(title)}&body=${enc(`${text ? text + "\n\n" : ""}${url}`)}`}
            className="bg-slate-700 text-white text-xs font-bold rounded-[10px] py-3 text-center hover:opacity-90 transition inline-flex items-center justify-center gap-1"
            onClick={() => {
              onShared?.("email");
              setTimeout(onClose, 100);
            }}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </a>
          {canNative && (
            <button
              onClick={doNative}
              className="bg-emerald-500 text-black text-xs font-bold rounded-[10px] py-3 hover:bg-emerald-400 inline-flex items-center justify-center gap-1"
            >
              <Share2 className="w-3.5 h-3.5" /> More
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2">
          <Link2 className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 bg-transparent text-xs text-slate-300 outline-none min-w-0"
          />
          <button
            onClick={copy}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-white/5 hover:bg-white/10 text-xs text-white"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}
