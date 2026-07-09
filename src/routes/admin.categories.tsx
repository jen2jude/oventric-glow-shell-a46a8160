import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { listCategories, upsertCategory, deleteCategory } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CategoriesPage,
});

type Row = { id: string; slug: string; name: string; description: string; sort_order: number; enabled: boolean };

function CategoriesPage() {
  const listFn = useServerFn(listCategories);
  const upFn = useServerFn(upsertCategory);
  const delFn = useServerFn(deleteCategory);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const refresh = useCallback(() => { listFn().then((r) => setRows(r as Row[])); }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!editing?.slug || !editing?.name) return alert("Slug and name required");
    await upFn({ data: {
      id: editing.id, slug: editing.slug, name: editing.name,
      description: editing.description ?? "", sort_order: editing.sort_order ?? 0, enabled: editing.enabled ?? true,
    } });
    setEditing(null); refresh();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Marketplace Categories</h1>
          <p className="text-sm text-slate-400">{rows?.length ?? 0} categories</p>
        </div>
        <button onClick={() => setEditing({ enabled: true, sort_order: (rows?.length ?? 0) })} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400">
          <Plus className="w-4 h-4" /> New
        </button>
      </header>

      {!rows ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" /> : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No categories.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((c) => (
            <div key={c.id} className="bg-[#141418] border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-white font-bold">{c.name} <span className="text-xs text-slate-500 font-mono ml-2">/{c.slug}</span></div>
                <div className="text-xs text-slate-500">{c.description || "—"} · sort {c.sort_order} · {c.enabled ? "enabled" : "disabled"}</div>
              </div>
              <button onClick={() => setEditing(c)} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200">Edit</button>
              <button onClick={async () => { if (confirm("Delete category?")) { await delFn({ data: { id: c.id } }); refresh(); } }} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#141418] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white text-lg font-black mb-4">{editing.id ? "Edit category" : "New category"}</h2>
            <div className="grid gap-3">
              <F label="Slug"><input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className={inp} /></F>
              <F label="Name"><input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} /></F>
              <F label="Description"><input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inp} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Sort order"><input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={inp} /></F>
                <F label="Enabled">
                  <select value={editing.enabled ? "y" : "n"} onChange={(e) => setEditing({ ...editing, enabled: e.target.value === "y" })} className={inp}>
                    <option value="y">Yes</option><option value="n">No</option>
                  </select>
                </F>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 text-sm">Cancel</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full bg-[#0b0b0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</div>{children}</label>;
}
