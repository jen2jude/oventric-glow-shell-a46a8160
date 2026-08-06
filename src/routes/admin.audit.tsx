import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { listAuditLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [{ title: "Audit Log · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuditPage,
});

type Row = Record<string, unknown>;

function AuditPage() {
  const listFn = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    listFn().then((r) => setRows(r as Row[]));
  }, [listFn]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black">Audit Log</h1>
        <p className="text-sm text-slate-400">Last 300 admin actions.</p>
      </header>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No admin activity yet.</p>
      ) : (
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Actor</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id as string} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                    {new Date(r.created_at as string).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-xs">
                    {String(r.actor_id ?? "").slice(0, 8) || "system"}
                  </td>
                  <td className="px-3 py-2 text-emerald-300 font-mono text-xs">
                    {r.action as string}
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs">
                    {(r.target_type as string) ?? "—"} ·{" "}
                    {String(r.target_id ?? "").slice(0, 8) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
