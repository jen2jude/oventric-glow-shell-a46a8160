import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { listCampaigns, upsertCampaign, deleteCampaign, type AdCampaignRow } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CampaignsPage,
});

const EMPTY: Partial<AdCampaignRow> = {
  title: "", advertiser: "", description: "", status: "draft", tier: "text",
  header: "", body: "", placements: ["feed"], cta_type: "url", cta_url: "", cta_label: "Learn more",
  start_at: null, end_at: null,
};

function CampaignsPage() {
  const listFn = useServerFn(listCampaigns);
  const upFn = useServerFn(upsertCampaign);
  const delFn = useServerFn(deleteCampaign);
  const [rows, setRows] = useState<AdCampaignRow[] | null>(null);
  const [editing, setEditing] = useState<Partial<AdCampaignRow> | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => { listFn().then((r) => setRows(r)); }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try { await upFn({ data: editing }); setEditing(null); refresh(); }
    catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Campaigns</h1>
          <p className="text-sm text-slate-400">{rows?.length ?? 0} campaigns</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400">
          <Plus className="w-4 h-4" /> New
        </button>
      </header>

      {!rows ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" /> : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No campaigns yet.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((c) => (
            <div key={c.id} className="bg-[#141418] border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold truncate">{c.title || "(untitled)"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase font-bold text-slate-300">{c.tier}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${c.status === "active" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-white/5 border-white/10 text-slate-400"}`}>{c.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{c.advertiser || "—"} · {(c.placements ?? []).join(", ") || "no placement"}</div>
              </div>
              <button onClick={() => setEditing(c)} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200">Edit</button>
              <button onClick={async () => { if (confirm("Delete campaign?")) { await delFn({ data: { id: c.id } }); refresh(); } }} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#141418] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white text-lg font-black mb-4">{editing.id ? "Edit campaign" : "New campaign"}</h2>
            <div className="grid gap-3">
              <Field label="Title"><input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputCls} /></Field>
              <Field label="Advertiser"><input value={editing.advertiser ?? ""} onChange={(e) => setEditing({ ...editing, advertiser: e.target.value })} className={inputCls} /></Field>
              <Field label="Header"><input value={editing.header ?? ""} onChange={(e) => setEditing({ ...editing, header: e.target.value })} className={inputCls} /></Field>
              <Field label="Body"><textarea value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={3} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tier">
                  <select value={editing.tier ?? "text"} onChange={(e) => setEditing({ ...editing, tier: e.target.value as AdCampaignRow["tier"] })} className={inputCls}>
                    <option value="text">Text</option><option value="image">Image</option><option value="video">Video</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select value={editing.status ?? "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value as AdCampaignRow["status"] })} className={inputCls}>
                    <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option>
                  </select>
                </Field>
              </div>
              <Field label="Placements (comma-separated: feed, marketplace, academy)">
                <input value={(editing.placements ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, placements: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTA label"><input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} className={inputCls} /></Field>
                <Field label="CTA URL"><input value={editing.cta_url ?? ""} onChange={(e) => setEditing({ ...editing, cta_url: e.target.value })} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><input type="datetime-local" value={editing.start_at ? editing.start_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, start_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inputCls} /></Field>
                <Field label="End"><input type="datetime-local" value={editing.end_at ? editing.end_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, end_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inputCls} /></Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full bg-[#0b0b0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</div>{children}</label>;
}
