import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldPlus, ShieldMinus, Ban } from "lucide-react";
import { listAdminUsers, setUserRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: UsersPage,
});

type Row = Record<string, unknown> & { roles?: string[] };

function UsersPage() {
  const listFn = useServerFn(listAdminUsers);
  const roleFn = useServerFn(setUserRole);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoadErr(null);
    listFn()
      .then((r) => setRows(r as Row[]))
      .catch((e) => {
        console.error("[admin.users] list failed", e);
        setLoadErr(e instanceof Error ? e.message : "Failed to load users");
        setRows([]);
      });
  }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (userId: string, role: "admin", grant: boolean) => {
    setBusy(userId);
    try { await roleFn({ data: { userId, role, grant } }); refresh(); }
    finally { setBusy(null); }
  };

  const filtered = (rows ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return String(r.username ?? "").toLowerCase().includes(s)
      || String(r.display_name ?? "").toLowerCase().includes(s)
      || String(r.user_id ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-black">Users</h1>
          <p className="text-sm text-slate-400">{rows?.length ?? 0} accounts</p>
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search username, name, id…"
          className="bg-[#141418] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-64"
        />
      </header>

      {!rows ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" /> : (
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Country</th>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2">Roles</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => {
                const isAdmin = (u.roles ?? []).includes("admin");
                const uid = u.user_id as string;
                return (
                  <tr key={uid} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <div className="text-white font-semibold">{(u.display_name as string) ?? (u.username as string) ?? uid.slice(0, 8)}</div>
                      <div className="text-[11px] text-slate-500 font-mono">@{u.username as string ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{(u.country as string) ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">L{(u.verification_tier as number) ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {(u.roles ?? []).length === 0 ? <span className="text-xs text-slate-500">user</span> : (u.roles ?? []).map((r) => (
                          <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold uppercase">{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => toggle(uid, "admin", !isAdmin)}
                        disabled={busy === uid}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isAdmin ? "bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25" : "bg-emerald-500 text-black hover:bg-emerald-400"}`}
                      >
                        {isAdmin ? <><ShieldMinus className="w-3 h-3" /> Revoke admin</> : <><ShieldPlus className="w-3 h-3" /> Make admin</>}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">
                  <Ban className="w-4 h-4 mx-auto mb-1 opacity-50" /> No matching users.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
