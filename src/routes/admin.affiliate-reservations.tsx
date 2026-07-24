import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Users, Mail, Globe, MessageSquare, Download } from "lucide-react";
import { listAffiliateReservations, type AffiliateReservationDTO } from "@/lib/affiliate.functions";

export const Route = createFileRoute("/admin/affiliate-reservations")({
  head: () => ({
    meta: [
      { title: "Affiliate Reservations · Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AffiliateReservationsPage,
});

function toCSV(rows: AffiliateReservationDTO[]): string {
  const header = ["created_at", "email", "display_name", "country", "user_id", "note"];
  const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.createdAt, r.email, r.displayName, r.country, r.userId, r.note].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function AffiliateReservationsPage() {
  const load = useServerFn(listAffiliateReservations);
  const [rows, setRows] = useState<AffiliateReservationDTO[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await load();
        if (!cancelled) setRows(r);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = (rows ?? []).filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      r.email.toLowerCase().includes(s) ||
      (r.displayName ?? "").toLowerCase().includes(s) ||
      (r.country ?? "").toLowerCase().includes(s)
    );
  });

  const download = () => {
    if (!rows) return;
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <Users className="w-6 h-6 text-fuchsia-300" /> Affiliate Reservations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Users who reserved an early seat for the upcoming affiliate program. Use this list to notify them at launch.
          </p>
        </div>
        <button
          onClick={download}
          disabled={!rows || rows.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </header>

      {err && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-lg p-3">{err}</div>
      )}

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, name, or country…"
          className="w-full sm:w-96 bg-[#0b0b0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
      </div>

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-white/10 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          <div className="col-span-3">User</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Country</div>
          <div className="col-span-2">Reserved</div>
          <div className="col-span-2">Note</div>
        </div>
        {!rows ? (
          <div className="p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">No reservations yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm items-start">
                <div className="col-span-3 min-w-0">
                  <div className="text-white font-semibold truncate">{r.displayName ?? "—"}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{r.userId}</div>
                </div>
                <div className="col-span-3 min-w-0 flex items-center gap-1.5 text-slate-300 text-xs">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <a href={`mailto:${r.email}`} className="truncate hover:text-white">{r.email}</a>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-xs text-slate-300">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  {r.country ?? "—"}
                </div>
                <div className="col-span-2 text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-2 text-xs text-slate-300 flex items-start gap-1.5 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="truncate" title={r.note ?? ""}>{r.note ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
