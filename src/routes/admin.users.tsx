import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, ShieldPlus, ShieldMinus, Ban, X, Save, KeyRound, Flag, Trash2, AlertTriangle, Mail, User as UserIcon,
} from "lucide-react";
import {
  listAdminUsers, setUserRole, getUserDetail, updateUserProfileAdmin,
  sendUserPasswordReset, setUserFlag, setUserBan, deleteUserAdmin,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  validateSearch: (s: Record<string, unknown>) => ({
    user: typeof s.user === "string" ? s.user : undefined,
  }),
  head: () => ({ meta: [{ title: "Users · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: UsersPage,
});

type Row = Record<string, unknown> & { roles?: string[]; flagged?: boolean; banned_at?: string | null };

function UsersPage() {
  const search = Route.useSearch();
  const listFn = useServerFn(listAdminUsers);
  const roleFn = useServerFn(setUserRole);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

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

  // Auto-open modal from ?user=... deep link
  useEffect(() => {
    if (search.user) setOpenUserId(search.user);
  }, [search.user]);

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
          <p className="text-sm text-slate-400">{rows?.length ?? 0} accounts · click a row to manage</p>
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search username, name, id…"
          className="bg-[#141418] border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-64"
        />
      </header>

      {loadErr && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-300">
          Could not load users: {loadErr}
        </div>
      )}
      {!rows ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" /> : (
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Country</th>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Roles</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => {
                const isAdmin = (u.roles ?? []).includes("admin");
                const uid = u.user_id as string;
                const flagged = Boolean(u.flagged);
                const banned = Boolean(u.banned_at);
                return (
                  <tr
                    key={uid}
                    onClick={() => setOpenUserId(uid)}
                    className="hover:bg-white/[0.03] cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div className="text-white font-semibold">{(u.display_name as string) ?? (u.username as string) ?? uid.slice(0, 8)}</div>
                      <div className="text-[11px] text-slate-500 font-mono">@{u.username as string ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{(u.country as string) ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{String(u.verification_tier ?? "TIER_0").replace("TIER_", "L")}</td>
                    <td className="px-3 py-2">
                      {banned ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 font-bold uppercase">Banned</span>
                      ) : flagged ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold uppercase">Flagged</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {(u.roles ?? []).length === 0 ? <span className="text-xs text-slate-500">user</span> : (u.roles ?? []).map((r) => (
                          <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold uppercase">{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
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
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-500">
                  <Ban className="w-4 h-4 mx-auto mb-1 opacity-50" /> No matching users.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {openUserId && (
        <UserDetailModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

/* -------- User Detail Modal -------- */

interface DetailData {
  profile: Record<string, unknown>;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  roles: string[];
  wallets: Array<{ currency: string; available_balance: number; escrow_balance: number }>;
  counts: { posts: number; products: number; orders: number; followers: number };
}

function UserDetailModal({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const detailFn = useServerFn(getUserDetail);
  const updateFn = useServerFn(updateUserProfileAdmin);
  const resetFn = useServerFn(sendUserPasswordReset);
  const flagFn = useServerFn(setUserFlag);
  const banFn = useServerFn(setUserBan);
  const deleteFn = useServerFn(deleteUserAdmin);

  const [d, setD] = useState<DetailData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [form, setForm] = useState<{ display_name: string; username: string; country: string; bio: string; phone: string; verification_tier: string }>({
    display_name: "", username: "", country: "", bio: "", phone: "", verification_tier: "TIER_0",
  });

  const load = useCallback(async () => {
    try {
      const res = await detailFn({ data: { userId } });
      setD(res as DetailData);
      const p = res.profile as Record<string, unknown>;
      setForm({
        display_name: (p.display_name as string) ?? "",
        username: (p.username as string) ?? "",
        country: (p.country as string) ?? "",
        bio: (p.bio as string) ?? "",
        phone: (p.phone as string) ?? "",
        verification_tier: (p.verification_tier as string) ?? "TIER_0",
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [detailFn, userId]);
  useEffect(() => { load(); }, [load]);

  const doSave = async () => {
    setSaving("save"); setErr(null);
    try { await updateFn({ data: { userId, ...form } }); await load(); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(null); }
  };
  const doReset = async () => {
    setSaving("reset"); setErr(null);
    try {
      const r = await resetFn({ data: { userId } });
      alert(`Password reset email sent to ${r.email}`);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(null); }
  };
  const doFlag = async () => {
    const flagged = !d?.profile.flagged;
    let reason: string | undefined;
    if (flagged) {
      const r = window.prompt("Flag reason (visible to admins):");
      if (r === null) return;
      reason = r;
    }
    setSaving("flag"); setErr(null);
    try { await flagFn({ data: { userId, flagged, reason } }); await load(); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(null); }
  };
  const doBan = async () => {
    const banned = !d?.profile.banned_at;
    if (banned && !window.confirm("Ban this user? They will be signed out and unable to sign in.")) return;
    setSaving("ban"); setErr(null);
    try { await banFn({ data: { userId, banned } }); await load(); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(null); }
  };
  const doDelete = async () => {
    if (!window.confirm("Permanently delete this user and all their data? This cannot be undone.")) return;
    if (!window.confirm("Really delete?")) return;
    setSaving("delete"); setErr(null);
    try { await deleteFn({ data: { userId } }); onChanged(); onClose(); }
    catch (e) { setErr((e as Error).message); setSaving(null); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#141418] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-[#141418] border-b border-white/10 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-emerald-300" />
            <h2 className="text-white font-bold">User details</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </header>

        {!d ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {err && <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-300">{err}</div>}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white text-lg font-black">{form.display_name || form.username || userId.slice(0, 8)}</div>
                <div className="text-xs text-slate-500 font-mono">@{form.username || "—"} · {userId}</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Mail className="w-3 h-3" />{d.email ?? "no email"}</div>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                {d.roles.map((r) => (
                  <span key={r} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold uppercase text-[10px]">{r}</span>
                ))}
                {Boolean(d.profile.banned_at) && <span className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 font-bold uppercase text-[10px]">Banned</span>}
                {Boolean(d.profile.flagged) && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold uppercase text-[10px]">Flagged</span>}
              </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-4 gap-2">
              {(["posts", "products", "orders", "followers"] as const).map((k) => (
                <div key={k} className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider">{k}</div>
                  <div className="text-white font-bold text-lg">{d.counts[k]}</div>
                </div>
              ))}
            </div>

            {/* Wallets */}
            {d.wallets.length > 0 && (
              <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3">
                <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-2">Wallets</div>
                <div className="grid grid-cols-2 gap-2">
                  {d.wallets.map((w) => (
                    <div key={w.currency} className="text-xs text-slate-300">
                      <span className="font-bold text-white">{w.currency}</span> · avail {Number(w.available_balance).toFixed(2)} · escrow {Number(w.escrow_balance).toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auth timestamps */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>Signed up: {d.auth_created_at ? new Date(d.auth_created_at).toLocaleString() : "—"}</div>
              <div>Last sign-in: {d.last_sign_in_at ? new Date(d.last_sign_in_at).toLocaleString() : "—"}</div>
              <div>Email confirmed: {d.email_confirmed_at ? new Date(d.email_confirmed_at).toLocaleString() : "not confirmed"}</div>
              <div>KYC: {d.profile.kyc_completed_at ? new Date(d.profile.kyc_completed_at as string).toLocaleString() : "—"}</div>
            </div>

            {/* Edit form */}
            <div className="bg-white/[0.02] border border-white/10 rounded-lg p-4 space-y-3">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">Edit profile</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Display name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
                <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
                <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <div className="col-span-2">
                  <label className="text-[10px] uppercase text-slate-500 tracking-wider">Bio</label>
                  <textarea
                    value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={2}
                    className="w-full bg-[#0b0b0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-500 tracking-wider">Verification tier</label>
                  <select
                    value={form.verification_tier}
                    onChange={(e) => setForm({ ...form, verification_tier: e.target.value })}
                    className="w-full bg-[#0b0b0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  >
                    {["TIER_0", "TIER_1", "TIER_2", "TIER_3"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={doSave}
                disabled={saving === "save"}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50"
              >
                {saving === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save changes
              </button>
            </div>

            {/* Danger zone */}
            <div className="bg-red-500/[0.03] border border-red-500/20 rounded-lg p-4 space-y-2">
              <div className="text-[10px] uppercase text-red-300 tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Moderation
              </div>
              <div className="flex flex-wrap gap-2">
                <ModBtn onClick={doReset} busy={saving === "reset"} icon={KeyRound} label="Send password reset" />
                <ModBtn onClick={doFlag} busy={saving === "flag"} icon={Flag}
                  label={d.profile.flagged ? "Remove flag" : "Flag user"}
                  tone={d.profile.flagged ? "neutral" : "amber"} />
                <ModBtn onClick={doBan} busy={saving === "ban"} icon={Ban}
                  label={d.profile.banned_at ? "Unban" : "Ban user"}
                  tone={d.profile.banned_at ? "neutral" : "red"} />
                <ModBtn onClick={doDelete} busy={saving === "delete"} icon={Trash2} label="Delete permanently" tone="red" />
              </div>
              {Boolean(d.profile.flag_reason) && (
                <div className="text-[11px] text-amber-200/80 mt-1">Flag note: {d.profile.flag_reason as string}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase text-slate-500 tracking-wider">{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0b0b0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
      />
    </div>
  );
}

function ModBtn({
  onClick, busy, icon: Icon, label, tone = "neutral",
}: { onClick: () => void; busy: boolean; icon: typeof KeyRound; label: string; tone?: "neutral" | "amber" | "red" }) {
  const cls =
    tone === "red" ? "bg-red-500/15 border-red-500/40 text-red-200 hover:bg-red-500/25"
    : tone === "amber" ? "bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
    : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold disabled:opacity-50 ${cls}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
