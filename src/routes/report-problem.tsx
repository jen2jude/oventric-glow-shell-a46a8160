import { createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitReport } from "@/lib/reports.functions";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { toast } from "sonner";
import { Bug, AlertTriangle, Ban, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/report-problem")({
  head: () => ({
    meta: [
      { title: "Report a problem — Oventric" },
      { name: "description", content: "Report bugs, abuse, or platform issues to the Oventric team." },
      { property: "og:title", content: "Report a problem — Oventric" },
      { property: "og:description", content: "Tell us what went wrong so we can fix it." },
    ],
  }),
  component: ReportPage,
});

const issues = [
  { key: "spam" as const, icon: AlertTriangle, title: "Spam or misleading content" },
  { key: "harassment" as const, icon: ShieldAlert, title: "Harassment, hate, or unsafe behavior" },
  { key: "ip" as const, icon: Ban, title: "Copyright / IP infringement" },
  { key: "scam" as const, icon: Bug, title: "Fraud, scam, or payment issue" },
];

function ReportPage() {
  const submit = useServerFn(submitReport);
  const { isAuthenticated, openGate } = useAuthGate();
  const [reason, setReason] = useState<"spam" | "harassment" | "ip" | "scam">("scam");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const onSubmit = async () => {
    if (!isAuthenticated) { openGate("generic"); return; }
    if (note.trim().length < 8) { toast.error("Please describe the issue in a bit more detail."); return; }
    setSending(true);
    try {
      await submit({ data: { targetId: "platform-report", targetKind: "platform", reason, note } });
      toast.success("Report received — thank you.");
      setNote("");
    } catch (e) {
      console.error(e);
      toast.error("Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicChrome>
      <div className="max-w-2xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">Report a problem</h1>
        <p className="mt-2 text-slate-400 md:text-slate-500">Bugs, abuse, or anything that feels wrong. Reports go straight to the admin dashboard.</p>

        <div className="mt-8 grid gap-2">
          {issues.map((it) => {
            const active = reason === it.key;
            return (
              <button
                key={it.key}
                onClick={() => setReason(it.key)}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors ${
                  active ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 bg-[#141418] hover:border-white/25"
                }`}
              >
                <span className={`w-9 h-9 grid place-items-center rounded-full ${active ? "bg-emerald-500/20 text-emerald-300" : "bg-[#1E1E24] md:bg-slate-100 text-slate-300 md:text-slate-600"}`}>
                  <it.icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-white md:text-slate-900">{it.title}</span>
              </button>
            );
          })}
        </div>

        <label className="block mt-6 text-xs font-bold text-slate-400 uppercase tracking-wide md:text-slate-500">What happened?</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 280))}
          placeholder="Please describe the issue — what you were doing, what you expected, what happened instead."
          rows={5}
          className="mt-2 w-full rounded-2xl bg-[#141418] border border-white/10 focus:border-emerald-400 outline-none p-3 text-sm text-white placeholder:text-slate-500 md:bg-white md:border-slate-200 md:text-slate-900"
        />
        <div className="mt-1 text-right text-[11px] text-slate-500">{note.length} / 280</div>

        <button
          onClick={onSubmit}
          disabled={sending}
          className="mt-4 w-full h-12 rounded-full bg-emerald-500 text-black font-bold text-sm disabled:opacity-60 hover:bg-emerald-400"
        >
          {sending ? "Sending..." : "Send report"}
        </button>
      </div>
    </PublicChrome>
  );
}
