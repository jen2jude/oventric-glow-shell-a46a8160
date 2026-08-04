import { CheckCircle2, Clock, FileCheck2, ShieldCheck, UserCheck2, Wallet, AlertTriangle } from "lucide-react";

export interface TimelineProfile {
  display_name: string | null;
  username: string | null;
}

export interface BountyTimelineData {
  created_at: string;
  accepted_applicant_id: string | null;
  accepted_at: string | null;
  solved_at: string | null;
  released_at: string | null;
  dispute_status: string;
  status: string;
}

interface Props {
  bounty: BountyTimelineData;
  applicationsCount: number;
  firstApplicationAt: string | null;
  acceptedProfile: TimelineProfile | null | undefined;
}

interface Step {
  key: string;
  label: string;
  detail?: string;
  at: string | null;
  icon: React.ReactNode;
  done: boolean;
  tone: "emerald" | "sky" | "fuchsia" | "amber" | "slate";
}

const TONES: Record<Step["tone"], { dot: string; line: string }> = {
  emerald: { dot: "bg-emerald-500 border-emerald-400", line: "bg-emerald-500/40" },
  sky: { dot: "bg-sky-500 border-sky-400", line: "bg-sky-500/40" },
  fuchsia: { dot: "bg-fuchsia-500 border-fuchsia-400", line: "bg-fuchsia-500/40" },
  amber: { dot: "bg-amber-500 border-amber-400", line: "bg-amber-500/40" },
  slate: { dot: "bg-slate-500 border-slate-400", line: "bg-slate-500/40" },
};

function who(p: TimelineProfile | null | undefined) {
  return p?.display_name || p?.username || "the solver";
}

export function BountyTimeline({ bounty, applicationsCount, firstApplicationAt, acceptedProfile }: Props) {
  const steps: Step[] = [
    {
      key: "created",
      label: "Bounty posted",
      at: bounty.created_at,
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      done: true,
      tone: "emerald",
    },
    {
      key: "proposals",
      label: applicationsCount > 0 ? `${applicationsCount} proposal${applicationsCount === 1 ? "" : "s"} received` : "Waiting for proposals",
      at: firstApplicationAt,
      icon: <Clock className="w-3.5 h-3.5" />,
      done: applicationsCount > 0,
      tone: "sky",
    },
    {
      key: "accepted",
      label: bounty.accepted_applicant_id ? `Solver accepted — ${who(acceptedProfile)}` : "Solver not yet assigned",
      at: bounty.accepted_at,
      icon: <UserCheck2 className="w-3.5 h-3.5" />,
      done: !!bounty.accepted_applicant_id,
      tone: "fuchsia",
    },
    {
      key: "delivered",
      label: bounty.solved_at ? "Work delivered" : "Awaiting delivery",
      at: bounty.solved_at,
      icon: <FileCheck2 className="w-3.5 h-3.5" />,
      done: !!bounty.solved_at,
      tone: "amber",
    },
    {
      key: "settled",
      label: bounty.released_at
        ? "Funds released"
        : bounty.dispute_status === "open"
          ? "In dispute — resolution pending"
          : "Awaiting release",
      at: bounty.released_at,
      icon: bounty.dispute_status === "open" && !bounty.released_at ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <Wallet className="w-3.5 h-3.5" />
      ),
      done: !!bounty.released_at,
      tone: bounty.released_at ? "emerald" : bounty.dispute_status === "open" ? "amber" : "slate",
    },
  ];

  return (
    <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl p-5 mb-5">
      <div className="text-white md:text-slate-900 font-bold text-sm mb-4 inline-flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-sky-400" /> Activity timeline
      </div>
      <ol className="relative pl-6">
        {steps.map((s, i) => {
          const tone = TONES[s.tone];
          const isLast = i === steps.length - 1;
          return (
            <li key={s.key} className="relative pb-5 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[-19px] top-4 bottom-0 w-px ${s.done ? tone.line : "bg-white/10 md:bg-slate-200"}`}
                />
              )}
              <span
                className={`absolute left-[-24px] top-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center text-white ${
                  s.done ? tone.dot : "bg-transparent border-white/20 md:border-slate-300"
                }`}
              />
              <div className={`text-sm font-semibold ${s.done ? "text-white md:text-slate-900" : "text-slate-500"}`}>
                {s.label}
              </div>
              {s.at && (
                <div className="text-[11px] text-slate-500 mt-0.5">{new Date(s.at).toLocaleString()}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
