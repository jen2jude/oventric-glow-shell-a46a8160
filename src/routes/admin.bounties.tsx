import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, Pencil, Plus, X, ImagePlus, Target, Calendar, Sparkles, ShieldCheck, ShieldX, Users, Lock, Unlock, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllBounties,
  adminCreateBounty,
  adminUpdateBounty,
  adminDeleteBounty,
  adminBountyDetail,
  adminApproveBounty,
  adminSetBountyHold,
  adminReleaseBounty,
  adminRefundBounty,
} from "@/lib/bounties.functions";

import { ResponsiveImage } from "@/components/ui/responsive-image";
export const Route = createFileRoute("/admin/bounties")({
  head: () => ({ meta: [{ title: "Bounties · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: BountiesAdminPage,
});

type Row = Record<string, unknown>;

const CATEGORIES = ["frontend", "database", "api", "uiux"] as const;
const STATUSES = ["active", "paused", "closed", "draft", "pending_review", "rejected", "solved", "released", "disputed"] as const;

interface FormState {
  id?: string;
  title: string;
  description: string;
  category: string;
  price_usd: string;
  applicant_limit: string;
  start_at: string;
  end_at: string;
  deadline_at: string;
  status: string;
  cover_path: string | null;
  cover_preview: string | null;
  promoted: boolean;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  category: "api",
  price_usd: "",
  applicant_limit: "10",
  start_at: "",
  end_at: "",
  deadline_at: "",
  status: "active",
  cover_path: null,
  cover_preview: null,
  promoted: false,
};


// Format ISO string -> HTML datetime-local (yyyy-MM-ddTHH:mm) in local tz.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function BountiesAdminPage() {
  const listFn = useServerFn(listAllBounties);
  const createFn = useServerFn(adminCreateBounty);
  const updateFn = useServerFn(adminUpdateBounty);
  const deleteFn = useServerFn(adminDeleteBounty);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"newest" | "oldest" | "status" | "deadline" | "price_high" | "price_low">("newest");

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const statusOrder: Record<string, number> = { active: 0, paused: 1, draft: 2, closed: 3 };
    const getTime = (v: unknown) => {
      const t = v ? new Date(v as string).getTime() : NaN;
      return Number.isNaN(t) ? 0 : t;
    };
    const filtered = rows.filter((b) => {
      if (categoryFilter !== "all" && (b.category as string) !== categoryFilter) return false;
      if (statusFilter !== "all" && (b.status as string) !== statusFilter) return false;
      if (!q) return true;
      const hay = `${(b.title as string) ?? ""} ${(b.description as string) ?? ""} ${(b.category as string) ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return getTime(a.created_at) - getTime(b.created_at);
        case "status": {
          const sa = statusOrder[(a.status as string) ?? ""] ?? 99;
          const sb = statusOrder[(b.status as string) ?? ""] ?? 99;
          if (sa !== sb) return sa - sb;
          return getTime(b.created_at) - getTime(a.created_at);
        }
        case "deadline":
          return (getTime(a.deadline_at) || Infinity) - (getTime(b.deadline_at) || Infinity);
        case "price_high":
          return Number(b.price_usd ?? 0) - Number(a.price_usd ?? 0);
        case "price_low":
          return Number(a.price_usd ?? 0) - Number(b.price_usd ?? 0);
        case "newest":
        default:
          return getTime(b.created_at) - getTime(a.created_at);
      }
    });
    return sorted;
  }, [rows, query, categoryFilter, statusFilter, sortKey]);

  const refresh = useCallback(() => {
    listFn().then((r) => setRows(r as Row[]));
  }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  const openCreate = () => setModal({ ...emptyForm });
  const openEdit = async (b: Row) => {
    const coverPath = (b.cover_path as string) ?? null;
    let coverPreview: string | null = null;
    if (coverPath) {
      const { data: signed } = await supabase.storage
        .from("bounty-covers")
        .createSignedUrl(coverPath, 60 * 60);
      coverPreview = signed?.signedUrl ?? null;
    }
    setModal({
      id: b.id as string,
      title: (b.title as string) ?? "",
      description: (b.description as string) ?? "",
      category: (b.category as string) ?? "api",
      price_usd: String(b.price_usd ?? ""),
      applicant_limit: String(b.applicant_limit ?? "10"),
      start_at: toLocalInput(b.start_at as string | null),
      end_at: toLocalInput(b.end_at as string | null),
      deadline_at: toLocalInput(b.deadline_at as string | null),
      status: (b.status as string) ?? "active",
      cover_path: coverPath,
      cover_preview: coverPreview,
      promoted: Boolean(b.promoted),
    });
  };

  const handleCoverPick = async (file: File) => {
    if (!modal) return;
    if (!file.type.startsWith("image/")) return toast.error("Cover must be an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploadingCover(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id ?? "admin";
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage
        .from("bounty-covers")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("bounty-covers")
        .createSignedUrl(path, 60 * 60);
      setModal((m) => m ? { ...m, cover_path: path, cover_preview: signed?.signedUrl ?? null } : m);
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const save = async () => {
    if (!modal) return;
    if (!modal.title.trim()) return toast.error("Title is required");
    const price = Number(modal.price_usd);
    if (!(price >= 0)) return toast.error("Price must be >= 0");
    const limit = Number(modal.applicant_limit);
    if (!(limit > 0)) return toast.error("Applicant limit must be > 0");
    const start = fromLocalInput(modal.start_at);
    const end = fromLocalInput(modal.end_at);
    const deadline = fromLocalInput(modal.deadline_at);
    if (start && end && new Date(end) <= new Date(start)) {
      return toast.error("End time must be after start time");
    }
    setSaving(true);
    try {
      const payload = {
        title: modal.title,
        description: modal.description,
        category: modal.category,
        price_usd: price,
        applicant_limit: limit,
        cover_path: modal.cover_path,
        start_at: start,
        end_at: end,
        deadline_at: deadline,
        status: modal.status as "active" | "paused" | "closed" | "draft",
        promoted: modal.promoted,
      };
      if (modal.id) {
        await updateFn({ data: { id: modal.id, ...payload } });
        toast.success("Bounty updated");
      } else {
        await createFn({ data: payload });
        toast.success("Bounty published");
      }
      setModal(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" /> Bounties
          </h1>
          <p className="text-sm text-slate-400">
            {filteredRows?.length ?? 0}
            {rows && filteredRows && filteredRows.length !== rows.length ? ` of ${rows.length}` : ""} bounties · admin can edit any, including user-posted ones
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New bounty
        </button>
      </header>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, description, category…"
          className={inputCls}
          aria-label="Search bounties"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={inputCls}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={inputCls}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className={inputCls}
          aria-label="Sort bounties"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="status">Status (active → closed)</option>
          <option value="deadline">Deadline (soonest)</option>
          <option value="price_high">Escrow (high → low)</option>
          <option value="price_low">Escrow (low → high)</option>
        </select>
      </div>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No bounties yet. Publish the first one.</p>
      ) : filteredRows && filteredRows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No bounties match your filters.</p>
      ) : (
        <div className="grid gap-3">
          {(filteredRows ?? []).map((b) => {
            const id = b.id as string;
            const status = b.status as string;
            const statusColor =
              status === "active" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" :
              status === "paused" ? "text-amber-300 border-amber-500/40 bg-amber-500/10" :
              status === "draft" ? "text-slate-300 border-slate-500/40 bg-slate-500/10" :
              "text-red-300 border-red-500/40 bg-red-500/10";
            return (
              <div key={id} className="bg-[#141418] border border-white/10 rounded-xl p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold truncate">{b.title as string}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${statusColor}`}>
                      {status}
                    </span>
                    {b.promoted ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold text-fuchsia-200 border-fuchsia-500/40 bg-fuchsia-500/10 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Promoted
                      </span>
                    ) : null}
                    {b.admin_hold ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold text-amber-200 border-amber-500/40 bg-amber-500/10 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> On hold
                      </span>
                    ) : null}
                    {b.dispute_status && b.dispute_status !== "none" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold text-red-200 border-red-500/40 bg-red-500/10">
                        Dispute · {b.dispute_status as string}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.category as string} · ${Number(b.price_usd).toFixed(2)} · limit {b.applicant_limit as number}
                    {b.deadline_at ? ` · due ${new Date(b.deadline_at as string).toLocaleDateString()}` : ""}
                    {b.solved_at ? ` · solved ${new Date(b.solved_at as string).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => setDetailId(id)}
                  className="px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5"
                  aria-label="Manage bounty"
                >
                  <Users className="w-4 h-4" /> Manage
                </button>
                <button
                  onClick={() => openEdit(b)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
                  aria-label="Edit bounty"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete bounty "${b.title}"? This cannot be undone.`)) return;
                    setBusy(id);
                    try { await deleteFn({ data: { id } }); refresh(); toast.success("Deleted"); }
                    catch (e) { toast.error((e as Error).message); }
                    setBusy(null);
                  }}
                  disabled={busy === id}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300"
                  aria-label="Delete bounty"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#141418] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-black text-lg">
                {modal.id ? "Edit bounty" : "New bounty"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cover image</span>
                <p className="text-[11px] text-slate-500 -mt-0.5 mb-2">Shown on bounty cards. PNG/JPG/WebP up to 5MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverPick(f); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-white/15 hover:border-emerald-500/50 bg-black/20 hover:bg-black/30 disabled:opacity-50 text-left"
                >
                  {modal.cover_preview ? (
                    <ResponsiveImage sizes="80px" src={modal.cover_preview} alt="Cover preview" className="w-20 h-20 object-cover rounded-md border border-white/10"  loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-20 h-20 rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-slate-500">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    {uploadingCover ? (
                      <div className="flex items-center gap-2 text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</div>
                    ) : modal.cover_preview ? (
                      <>
                        <div className="text-slate-200 font-medium">Image attached</div>
                        <div className="text-slate-500 mt-0.5">Click to replace</div>
                      </>
                    ) : (
                      <div className="text-slate-400">Click to upload a cover image (recommended 4:3).</div>
                    )}
                  </div>
                  {modal.cover_preview && !uploadingCover && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setModal((m) => m ? { ...m, cover_path: null, cover_preview: null } : m); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setModal((m) => m ? { ...m, cover_path: null, cover_preview: null } : m); } }}
                      className="p-1.5 rounded-md bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              </div>

              <Field label="Title">
                <input
                  value={modal.title}
                  onChange={(e) => setModal({ ...modal, title: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Fix Paystack webhook loop"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select
                    value={modal.category}
                    onChange={(e) => setModal({ ...modal, category: e.target.value })}
                    className={inputCls}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={modal.status}
                    onChange={(e) => setModal({ ...modal, status: e.target.value })}
                    className={inputCls}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modal.promoted}
                  onChange={(e) => setModal({ ...modal, promoted: e.target.checked })}
                  className="w-4 h-4 accent-fuchsia-500"
                />
                <Sparkles className="w-4 h-4 text-fuchsia-300" />
                <span className="text-xs text-slate-200">
                  <span className="font-bold text-fuchsia-200">Promote this bounty</span> — feature it at the top of the public board.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Escrow (USD)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modal.price_usd}
                    onChange={(e) => setModal({ ...modal, price_usd: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Applicant limit">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={modal.applicant_limit}
                    onChange={(e) => setModal({ ...modal, applicant_limit: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={modal.description}
                  onChange={(e) => setModal({ ...modal, description: e.target.value })}
                  rows={4}
                  className={inputCls}
                  placeholder="Scope, deliverables, acceptance criteria…"
                />
              </Field>

              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-2">
                  <Calendar className="w-3.5 h-3.5" /> Schedule
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Starts">
                    <input
                      type="datetime-local"
                      value={modal.start_at}
                      onChange={(e) => setModal({ ...modal, start_at: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Ends (listing)">
                    <input
                      type="datetime-local"
                      value={modal.end_at}
                      onChange={(e) => setModal({ ...modal, end_at: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Deadline (delivery)">
                    <input
                      type="datetime-local"
                      value={modal.deadline_at}
                      onChange={(e) => setModal({ ...modal, deadline_at: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Start/End control when the bounty is visible on the public board. Deadline is the delivery due date shown to applicants.
                </p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  disabled={saving}
                  onClick={save}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-lg flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {modal.id ? "Save changes" : "Publish bounty"}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailId && (
        <BountyDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

interface DetailData {
  bounty: Record<string, unknown>;
  applications: Array<{ id: string; applicant_id: string; pitch: string; status: string; created_at: string }>;
  profiles: Array<{ user_id: string; display_name: string | null; username: string | null; slug: string | null; avatar_path: string | null }>;
  posterWallet: { available_balance: number; escrow_balance: number };
}

function BountyDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const detailFn = useServerFn(adminBountyDetail);
  const approveFn = useServerFn(adminApproveBounty);
  const holdFn = useServerFn(adminSetBountyHold);
  const releaseFn = useServerFn(adminReleaseBounty);
  const refundFn = useServerFn(adminRefundBounty);
  const [data, setData] = useState<DetailData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    detailFn({ data: { id } }).then((d) => setData(d as DetailData));
  }, [detailFn, id]);
  useEffect(() => { load(); }, [load]);

  const profileFor = (uid: string | null | undefined) =>
    data?.profiles.find((p) => p.user_id === uid) ?? null;

  const nameOf = (uid: string | null | undefined) => {
    const p = profileFor(uid);
    return p?.display_name || p?.username || (uid ? uid.slice(0, 8) : "—");
  };

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); toast.success(label); load(); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <button className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
    );
  }

  const b = data.bounty;
  const status = b.status as string;
  const price = Number(b.price_usd);
  const solverCut = Number((price * 0.8).toFixed(2));
  const platformCut = Number((price - solverCut).toFixed(2));
  const isPendingReview = status === "pending_review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#121216] border border-white/10 rounded-2xl p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-black text-lg inline-flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" /> Manage bounty
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <section className="p-3 rounded-xl border border-white/10 bg-black/30 mb-3">
          <div className="text-white font-bold">{b.title as string}</div>
          <div className="text-xs text-slate-400 mt-1">
            Poster: <span className="text-slate-200">{nameOf(b.poster_id as string)}</span> · Escrow ${price.toFixed(2)}
            {b.solved_at ? ` · Solved ${new Date(b.solved_at as string).toLocaleString()}` : ""}
            {b.released_at ? ` · Released ${new Date(b.released_at as string).toLocaleString()}` : ""}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2 text-[10px] uppercase font-bold">
            <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-slate-200">{status}</span>
            {b.promoted ? <span className="px-1.5 py-0.5 rounded border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Promoted</span> : null}
            {b.admin_hold ? <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Hold</span> : null}
            {b.dispute_status && b.dispute_status !== "none" ? <span className="px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-200">Dispute · {b.dispute_status as string}</span> : null}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 mb-3">
          <div className="p-3 rounded-xl border border-white/10 bg-black/30">
            <div className="text-[10px] uppercase text-slate-500">Poster wallet (USD)</div>
            <div className="text-white text-lg font-bold mt-1">${data.posterWallet.available_balance.toFixed(2)}</div>
            <div className="text-xs text-slate-400">Escrow ${data.posterWallet.escrow_balance.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-xl border border-white/10 bg-black/30">
            <div className="text-[10px] uppercase text-slate-500">On release split</div>
            <div className="text-emerald-300 text-sm font-bold mt-1">Solver ${solverCut.toFixed(2)} <span className="text-slate-500 text-xs">(80%)</span></div>
            <div className="text-fuchsia-300 text-sm font-bold">Platform ${platformCut.toFixed(2)} <span className="text-slate-500 text-xs">(20%)</span></div>
          </div>
        </section>

        <section className="p-3 rounded-xl border border-white/10 bg-black/30 mb-3">
          <div className="text-xs uppercase text-slate-500 mb-2">Admin actions</div>
          <div className="flex flex-wrap gap-2">
            {isPendingReview && (
              <>
                <button disabled={busy} onClick={() => runAction("Approved", () => approveFn({ data: { id, approve: true } }))}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                  <ShieldCheck className="w-3.5 h-3.5" /> Approve
                </button>
                <button disabled={busy} onClick={() => {
                  const reason = prompt("Reason for rejection?") ?? "";
                  return runAction("Rejected & refunded", () => approveFn({ data: { id, approve: false, reason } }));
                }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                  <ShieldX className="w-3.5 h-3.5" /> Reject & refund
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => runAction(b.admin_hold ? "Hold released" : "Escrow held", () => holdFn({ data: { id, hold: !b.admin_hold } }))}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
              {b.admin_hold ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {b.admin_hold ? "Release hold" : "Hold escrow"}
            </button>
            <button disabled={busy || !b.accepted_applicant_id} onClick={() => {
              if (!confirm(`Release $${solverCut.toFixed(2)} to solver and $${platformCut.toFixed(2)} to platform?`)) return;
              return runAction("Escrow released", () => releaseFn({ data: { id } }));
            }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> Release to solver
            </button>
            <button disabled={busy} onClick={() => {
              const reason = prompt("Refund reason?") ?? "Admin refund";
              if (!confirm(`Refund $${price.toFixed(2)} to poster wallet?`)) return;
              return runAction("Escrow refunded", () => refundFn({ data: { id, reason } }));
            }}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" /> Refund poster
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Auto-release runs 48 hours after a solver marks the work solved unless a dispute is open or admin is holding funds.
          </p>
        </section>

        <section className="p-3 rounded-xl border border-white/10 bg-black/30">
          <div className="text-xs uppercase text-slate-500 mb-2">
            Applicants ({data.applications.length})
            {b.accepted_applicant_id ? (
              <span className="ml-2 text-emerald-300 normal-case">Accepted: {nameOf(b.accepted_applicant_id as string)}</span>
            ) : null}
          </div>
          {data.applications.length === 0 ? (
            <div className="text-xs text-slate-500">No applicants yet.</div>
          ) : (
            <div className="space-y-2">
              {data.applications.map((a) => {
                const p = profileFor(a.applicant_id);
                const isAccepted = a.applicant_id === b.accepted_applicant_id;
                return (
                  <div key={a.id} className={`p-2.5 rounded-lg border ${isAccepted ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 bg-black/20"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-white font-semibold">
                        {p?.display_name || p?.username || a.applicant_id.slice(0, 8)}
                        {p?.slug ? <span className="text-slate-500 text-xs ml-1">@{p.slug}</span> : null}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                        a.status === "accepted" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" :
                        a.status === "rejected" ? "text-red-300 border-red-500/40 bg-red-500/10" :
                        "text-slate-300 border-white/10 bg-white/5"
                      }`}>{a.status}</span>
                    </div>
                    {a.pitch ? <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{a.pitch}</div> : null}
                    <div className="text-[10px] text-slate-600 mt-1">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/60 outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
