import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsUp, Laugh, Crown } from "lucide-react";
import type { ReactionType } from "@/lib/posts.functions";

export const REACTION_META: Record<
  ReactionType,
  { label: string; Icon: typeof Heart; color: string }
> = {
  love: { label: "Love", Icon: Heart, color: "#f43f5e" },
  like: { label: "Like", Icon: ThumbsUp, color: "#38bdf8" },
  laugh: { label: "Haha", Icon: Laugh, color: "#facc15" },
  crown: { label: "Crown", Icon: Crown, color: "#a78bfa" },
};

export const REACTION_ORDER: ReactionType[] = ["love", "like", "laugh", "crown"];

/** Default flat reaction button. */
export function ReactionButton({
  reaction,
  onClick,
  size = "md",
  ariaLabel,
  className,
}: {
  reaction: ReactionType;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: "xs" | "sm" | "md" | "lg";
  ariaLabel?: string;
  className?: string;
}) {
  const m = REACTION_META[reaction];
  const Icon = m.Icon;
  const dims =
    size === "xs" ? "w-6 h-6 rounded-md"
    : size === "sm" ? "w-8 h-8 rounded-full"
    : size === "lg" ? "w-14 h-14 rounded-2xl"
    : "w-10 h-10 rounded-full";
  const iconSize = size === "xs" ? 12 : size === "sm" ? 16 : size === "lg" ? 28 : 20;
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? m.label}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center transition-transform duration-150 active:scale-95",
        dims,
        className,
      ].join(" ")}
      style={{
        backgroundColor: `${m.color}e6`,
        color: "#ffffff",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <Icon size={iconSize} strokeWidth={2.5} className="fill-current" />
    </button>
  );
}

/** Floating chooser rendered above a trigger button. */
export function ReactionPicker({
  onPick,
  onClose,
  align = "left",
}: {
  onPick: (r: ReactionType) => void;
  onClose: () => void;
  align?: "left" | "right" | "center";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  const alignCls =
    align === "right" ? "right-0"
    : align === "center" ? "left-1/2 -translate-x-1/2"
    : "left-0";
  return (
    <div
      ref={ref}
      className={`absolute bottom-full ${alignCls} mb-3 z-30 flex items-center gap-2 rounded-full bg-[#141418] border border-white/10 px-2.5 py-2 shadow-xl shadow-black/60 animate-in fade-in slide-in-from-bottom-2 duration-150`}
    >
      {REACTION_ORDER.map((r) => (
        <ReactionButton
          key={r}
          reaction={r}
          size="md"
          onClick={(e) => {
            e.stopPropagation();
            onPick(r);
          }}
        />
      ))}
    </div>
  );
}

/** One-shot splash that animates in the center of a container. */
export function ReactionSplash({ reaction, keyId }: { reaction: ReactionType; keyId: string | number }) {
  const m = REACTION_META[reaction];
  const Icon = m.Icon;
  return (
    <div
      key={keyId}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
    >
      <div
        className="rounded-2xl p-4 text-white"
        style={{
          backgroundColor: m.color,
          animation: "reaction-splash 900ms cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <Icon className="w-12 h-12 fill-current" strokeWidth={2} />
      </div>
    </div>
  );
}

/** Clean flat badge on bottom-right of an image or video. */
export function ReactionImageBadge({ reaction }: { reaction: ReactionType }) {
  const m = REACTION_META[reaction];
  const Icon = m.Icon;
  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
      <div
        className="rounded-2xl w-10 h-10 flex items-center justify-center text-white"
        style={{ backgroundColor: m.color }}
      >
        <Icon className="w-5 h-5 fill-current" strokeWidth={2.5} />
      </div>
    </div>
  );
}

/** Hook that manages picker + splash state for a single reactable target. */
export function useReactionSplash() {
  const [splash, setSplash] = useState<{ id: number; reaction: ReactionType } | null>(null);
  const fire = (reaction: ReactionType) => {
    setSplash({ id: Date.now(), reaction });
    setTimeout(() => setSplash((s) => (s && s.reaction === reaction ? null : s)), 1000);
  };
  return { splash, fire };
}
