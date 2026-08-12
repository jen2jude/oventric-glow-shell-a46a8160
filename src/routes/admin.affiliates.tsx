import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Download, Users } from "lucide-react";
import { listAffiliateReservations, type AffiliateReservationDTO } from "@/lib/affiliate.functions";

export const Route = createFileRoute("/admin/affiliates")({
  head: () => ({
    meta: [
      { title: "Affiliate Reservations · Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AffiliateReservationsPage,
});

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

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.email, r.displayName, r.country, r.note, r.userId]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term)),
    );
  }, [rows, q]);

  function exportCsv() {
    if (!rows) return;
    const header = ["created_at", "email", "display_name", "country", "user_id", "note"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        r.createdAt,
        r.email,
        r.displayName ?? "",
        r.country ?? "",
        r.userId,
        (r.note ?? "").replace(/"/g, '""'),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <Users className="w-6 h-6 text-fuchsia-300" /> Affiliate Reservations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Users who have reserved a spot in the upcoming affiliate program. Use this list to
            notify them at launch.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!rows || rows.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      {err && (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-[10px] p-3">
          {err}
        </div>
      )}

      <div className="mb-4 relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, name, country…"
          className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500"
        />
      </div>

      <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_140px_100px_180px] gap-3 px-4 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/10 bg-black/20">
          <div>Email</div>
          <div>Name</div>
          <div>Country</div>
          <div>Reserved</div>
          <div>User ID</div>
        </div>
        {!filtered ? (
          <div className="p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-slate-500 text-center">No reservations yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_1fr_140px_100px_180px] gap-3 px-4 py-3 text-sm items-center"
              >
                <div className="text-white truncate" title={r.email}>
                  {r.email}
                </div>
                <div className="text-slate-300 truncate">{r.displayName ?? "—"}</div>
                <div className="text-slate-400">{r.country ?? "—"}</div>
                <div className="text-slate-400 text-xs">
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
                <div className="text-slate-500 font-mono text-[11px] truncate" title={r.userId}>
                  {r.userId}
                </div>
                {r.note && (
                  <div className="col-span-5 text-[11px] text-slate-400 -mt-1 pl-1 italic">
                    “{r.note}”
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
