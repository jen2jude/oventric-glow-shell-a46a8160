import { ArrowDownUp } from "lucide-react";

export type ProposalSortKey = "newest" | "oldest" | "highest_score" | "most_urgent";

export interface SortableProposal {
  id: string;
  pitch: string;
  status: string;
  created_at: string;
}

const OPTIONS: { key: ProposalSortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "highest_score", label: "Highest score" },
  { key: "most_urgent", label: "Most urgent" },
];

/** Simple proxy for proposal "score" — thoughtfulness/length of pitch. */
export function proposalScore(a: SortableProposal): number {
  return Math.min(100, Math.round((a.pitch?.trim().length ?? 0) / 4));
}

export function sortProposals<T extends SortableProposal>(list: T[], key: ProposalSortKey): T[] {
  const arr = [...list];
  switch (key) {
    case "oldest":
      return arr.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "highest_score":
      return arr.sort((a, b) => proposalScore(b) - proposalScore(a));
    case "most_urgent":
      // Pending proposals waiting longest are most urgent to act on.
      return arr.sort((a, b) => {
        const aPending = a.status === "pending" ? 0 : 1;
        const bPending = b.status === "pending" ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    case "newest":
    default:
      return arr.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

export function ProposalSortDropdown({
  value,
  onChange,
}: {
  value: ProposalSortKey;
  onChange: (v: ProposalSortKey) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 md:text-slate-500">
      <ArrowDownUp className="w-3.5 h-3.5" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProposalSortKey)}
        className="bg-white/5 md:bg-slate-100 border border-white/10 md:border-slate-200 rounded-[10px] px-2 py-1 text-[11px] font-bold text-slate-200 md:text-slate-700 outline-none focus:border-sky-500/60"
      >
        {OPTIONS.map((o) => (
          <option key={o.key} value={o.key} className="text-black">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
