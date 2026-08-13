import { useEffect, useState } from "react";
import { X, PenSquare, Target, ShoppingBag, GraduationCap, ArrowRight, Sparkles } from "lucide-react";
import { useOnboarding, type Tier } from "@/lib/onboarding/OnboardingContext";
import { SellSwitcherModal } from "./SellSwitcherModal";
import { CoursePublishWizard } from "./CoursePublishWizard";
import { BountyEditorModal } from "./BountyEditorModal";

export type ChoiceKey = "post" | "bounty" | "sell" | "course";
type Choice = {
  key: ChoiceKey;
  icon: typeof PenSquare;
  title: string;
  desc: string;
  tier: Tier;
  accent: string;
  tint: string;
  badge?: string;
};

const choices: Choice[] = [
  {
    key: "post",
    icon: PenSquare,
    title: "Drop a Post",
    desc: "Share updates, ideas, or moments with the community.",
    tier: 1,
    accent: "#A78BFA",
    tint: "rgba(167,139,250,0.10)",
    badge: "NEW",
  },
  {
    key: "bounty",
    icon: Target,
    title: "Post a Bounty ($)",
    desc: "Get expert help from the community and pay on delivery.",
    tier: 2,
    accent: "#4CC2FF",
    tint: "rgba(76,194,255,0.09)",
  },
  {
    key: "sell",
    icon: ShoppingBag,
    title: "Sell",
    desc: "List digital assets or physical products.",
    tier: 2,
    accent: "#2BD07A",
    tint: "rgba(43,208,122,0.09)",
  },
  {
    key: "course",
    icon: GraduationCap,
    title: "Publish a Course",
    desc: "Teach with video modules, free or paid.",
    tier: 2,
    accent: "#F7A50A",
    tint: "rgba(247,165,10,0.09)",
  },
];


export function CreatePanel({
  open,
  onClose,
  initialChoice,
}: {
  open: boolean;
  onClose: () => void;
  initialChoice?: ChoiceKey | null;
}) {
  const { require } = useOnboarding();
  const [sellOpen, setSellOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [bountyOpen, setBountyOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleChoice = (c: Choice) => {
    require(c.tier, () => {
      if (c.key === "sell") {
        onClose();
        setSellOpen(true);
        return;
      }
      if (c.key === "course") {
        onClose();
        setCourseOpen(true);
        return;
      }
      if (c.key === "bounty") {
        onClose();
        setBountyOpen(true);
        return;
      }
      onClose();
      window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Feed" } }));
      // Delay so Feed can mount before we scroll/focus its composer.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("oventric:create", { detail: { kind: c.key } }));
      }, 80);
    });
  };

  useEffect(() => {
    if (!open || !initialChoice) return;
    const choice = choices.find((item) => item.key === initialChoice);
    if (!choice) return;
    handleChoice(choice);
    // The requested choice is intentionally handled once when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialChoice]);

  return (
    <>
      {open && (
        <div className="modal-light fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <div className="slide-up relative w-full max-w-2xl bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create Something</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {choices.map((c) => (
                <button
                  key={c.key}
                  onClick={() => handleChoice(c)}
                  className="group text-left p-4 bg-[#121214] border border-white/10 rounded-xl hover:border-emerald-500/60 hover:bg-[#161618] transition-all"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
                    <c.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="font-semibold text-white">{c.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <SellSwitcherModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <CoursePublishWizard
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        onSaved={() => {
          setCourseOpen(false);
          window.dispatchEvent(
            new CustomEvent("oventric:navigate", { detail: { section: "Academy" } }),
          );
        }}
      />
      <BountyEditorModal
        open={bountyOpen}
        onClose={() => setBountyOpen(false)}
        onPublished={() => {
          window.dispatchEvent(
            new CustomEvent("oventric:navigate", { detail: { section: "Bounties" } }),
          );
        }}
      />
    </>
  );
}
