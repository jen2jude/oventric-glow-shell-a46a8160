import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsUp, Laugh, Crown } from "lucide-react";
import type { ReactionType } from "@/lib/posts.functions";

export const REACTION_META: Record<
  ReactionType,
  { label: string; Icon: typeof Heart; color: string; glow: string }
> = {
  love: { label: "Love", Icon: Heart, color: "#f43f5e", glow: "rgba(244,63,94,0.75)" },
  like: { label: "Like", Icon: ThumbsUp, color: "#38bdf8", glow: "rgba(56,189,248,0.75)" },
  laugh: { label: "Haha", Icon: Laugh, color: "#facc15", glow: "rgba(250,204,21,0.75)" },
  crown: { label: "Crown", Icon: Crown, color: "#a78bfa", glow: "rgba(167,139,250,0.75)" },
};

export const REACTION_ORDER: ReactionType[] = ["love", "like", "laugh", "crown"];

/** Floating chooser rendered above a trigger button. */
export function ReactionPicker({
  onPick,
  onClose,
}: {
  onPick: (r: ReactionType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 z-30 flex items-center gap-1 rounded-full bg-[#1a1a1e] border border-white/15 px-2 py-1.5 shadow-lg shadow-black/50 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {REACTION_ORDER.map((r) => {
        const m = REACTION_META[r];
        const Icon = m.Icon;
        return (
          <button
            key={r}
            type="button"
            aria-label={m.label}
            onClick={(e) => {
              e.stopPropagation();
              onPick(r);
            }}
            className="p-1.5 rounded-full hover:scale-125 transition-transform"
            style={{ color: m.color }}
          >
            <Icon className="w-5 h-5 fill-current" />
          </button>
        );
      })}
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
        className="rounded-full p-4"
        style={{
          color: m.color,
          animation: "reaction-splash 900ms cubic-bezier(0.16,1,0.3,1) forwards",
          filter: `drop-shadow(0 0 12px ${m.glow})`,
        }}
      >
        <Icon className="w-16 h-16 fill-current" strokeWidth={1.5} />
      </div>
    </div>
  );
}

/** Persistent RGB-neon badge on bottom-right of an image or video. */
export function ReactionImageBadge({ reaction }: { reaction: ReactionType }) {
  const m = REACTION_META[reaction];
  const Icon = m.Icon;
  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
      <div className="relative rgb-neon-bg rounded-full p-[2px]">
        <div
          className="rounded-full bg-[#1E1E24] w-10 h-10 flex items-center justify-center"
          style={{ color: m.color, animation: "reaction-breathe 2.4s ease-in-out infinite" }}
        >
          <Icon className="w-5 h-5 fill-current" />
        </div>
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
