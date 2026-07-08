import { Flag, X } from "lucide-react";
import { useEffect, useState } from "react";

const REASONS = [
  { id: "spam", label: "Spam", desc: "Unsolicited promotions, mass posting, or bots." },
  { id: "harassment", label: "Harassment", desc: "Hate speech, targeted abuse, or threats." },
  { id: "ip", label: "Intellectual Property", desc: "Copyright, trademark, or code license violation." },
  { id: "scam", label: "Scam", desc: "Phishing, fake bounties, or fraudulent listings." },
] as const;

export function ReportModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target?: string;
}) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setNote("");
      setSubmitted(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!reason) return;
    setSubmitted(true);
    setTimeout(onClose, 1400);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-semibold text-sm">Report {target ?? "content"}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </header>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-3">
              <Flag className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-white font-semibold text-sm">Report submitted</div>
            <p className="text-xs text-slate-400 mt-1">Our trust &amp; safety team will review within 24h.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-400">Choose the reason that best describes the issue.</p>
            <div className="grid gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    reason === r.id
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{r.label}</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border ${
                        reason === r.id ? "bg-emerald-400 border-emerald-400" : "border-white/30"
                      }`}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Add a short custom reason (optional)</label>
              <textarea
                rows={3}
                maxLength={280}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell us anything else that helps us review this…"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              <div className="text-[10px] text-slate-500 text-right mt-1">{note.length}/280</div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!reason}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm"
              >
                Submit report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
