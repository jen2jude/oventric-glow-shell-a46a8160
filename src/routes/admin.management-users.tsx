import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, KeyRound, Trash2, ShieldCheck, Loader2, X } from "lucide-react";
import {
  listManagementUsers,
  createManagementUser,
  updateManagementUserRoles,
  resetManagementUserPassword,
  revokeManagementAccess,
  type ManagementUserDTO,
} from "@/lib/management-users.functions";
import {
  MANAGEMENT_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type ManagementRole,
} from "@/lib/admin-roles";

export const Route = createFileRoute("/admin/management-users")({
  head: () => ({
    meta: [
      { title: "Management Users · Oventric Admin" },
      {
        name: "description",
        content: "Create admin & staff accounts and assign role-based access.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ManagementUsersPage,
});

function ManagementUsersPage() {
  const list = useServerFn(listManagementUsers);
  const [users, setUsers] = useState<ManagementUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pwFor, setPwFor] = useState<ManagementUserDTO | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await list();
      setUsers(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Management Users</h1>
          <p className="text-sm text-slate-400 mt-1">
            Create admin / staff accounts and control which sections of the console they see.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-[10px]"
        >
          <UserPlus className="w-4 h-4" /> New management user
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
        {MANAGEMENT_ROLES.map((r) => (
          <div key={r} className="bg-[#141418] border border-white/10 rounded-xl p-3">
            <div className="text-white text-sm font-bold">{ROLE_LABELS[r]}</div>
            <div className="text-xs text-slate-400 mt-1">{ROLE_DESCRIPTIONS[r]}</div>
          </div>
        ))}
      </div>

      {err && <div className="text-sm text-red-400 mb-4">{err}</div>}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Roles</th>
                <th className="text-left px-4 py-3">Last sign-in</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No management users yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <UserRow
                    key={u.userId}
                    user={u}
                    onChanged={refresh}
                    onResetPw={() => setPwFor(u)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
      {pwFor && <ResetPasswordModal user={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  );
}

function UserRow({
  user,
  onChanged,
  onResetPw,
}: {
  user: ManagementUserDTO;
  onChanged: () => void;
  onResetPw: () => void;
}) {
  const updateRoles = useServerFn(updateManagementUserRoles);
  const revoke = useServerFn(revokeManagementAccess);
  const [roles, setRoles] = useState<ManagementRole[]>(user.roles);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify([...roles].sort()) !== JSON.stringify([...user.roles].sort());

  const toggle = (r: ManagementRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateRoles({ data: { userId: user.userId, roles } });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };
  const doRevoke = async () => {
    if (!confirm(`Revoke all management access for ${user.email}?`)) return;
    try {
      await revoke({ data: { userId: user.userId } });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-3">
        <div className="text-white font-semibold">{user.displayName || "—"}</div>
        <div className="text-xs text-slate-400">{user.email}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {MANAGEMENT_ROLES.map((r) => {
            const active = roles.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggle(r)}
                className={`px-2 py-1 rounded-[10px] text-[11px] font-semibold border ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            );
          })}
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="mt-2 text-xs px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded"
          >
            {saving ? "Saving…" : "Save roles"}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "Never"}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            onClick={onResetPw}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-slate-200"
          >
            <KeyRound className="w-3.5 h-3.5" /> Reset password
          </button>
          <button
            onClick={doRevoke}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-xs text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" /> Revoke
          </button>
        </div>
      </td>
    </tr>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createManagementUser);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [roles, setRoles] = useState<ManagementRole[]>(["support"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await create({ data: { email, password, displayName: displayName || undefined, roles } });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New management user" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="team@oventric.com"
          />
        </Field>
        <Field label="Display name (optional)">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Temporary password (8+ chars)">
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls + " pr-16"}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        <Field label="Roles">
          <div className="flex flex-wrap gap-2">
            {MANAGEMENT_ROLES.map((r) => {
              const active = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    setRoles((prev) =>
                      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
                    )
                  }
                  className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold border ${
                    active
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                      : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              );
            })}
          </div>
        </Field>
        {err && <div className="text-xs text-red-400">{err}</div>}
        <button
          type="submit"
          disabled={busy || roles.length === 0}
          className="mt-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-[10px]"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: ManagementUserDTO; onClose: () => void }) {
  const reset = useServerFn(resetManagementUserPassword);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await reset({ data: { userId: user.userId, password } });
      setOk(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Reset password — ${user.email}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="New password (8+ chars)">
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls + " pr-16"}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        {err && <div className="text-xs text-red-400">{err}</div>}
        {ok && (
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Password updated.
          </div>
        )}
        <button
          type="submit"
          disabled={busy || ok}
          className="mt-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-[10px]"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </Modal>
  );
}

const inputCls =
  "w-full px-3 py-2.5 bg-[#0b0b0d] border border-white/10 rounded-[10px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#141418] border border-white/10 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
