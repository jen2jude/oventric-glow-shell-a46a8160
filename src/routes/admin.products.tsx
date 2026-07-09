import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Star, Trash2 } from "lucide-react";
import { listAllProducts, deleteProductAdmin, setProductPromoted } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ProductsPage,
});

type Row = Record<string, unknown>;

function ProductsPage() {
  const listFn = useServerFn(listAllProducts);
  const delFn = useServerFn(deleteProductAdmin);
  const promFn = useServerFn(setProductPromoted);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => { listFn().then((r) => setRows(r as Row[])); }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black">Products</h1>
        <p className="text-sm text-slate-400">{rows?.length ?? 0} listings</p>
      </header>

      {!rows ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" /> : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No products yet.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => {
            const id = p.id as string;
            return (
              <div key={id} className="bg-[#141418] border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold truncate">{p.name as string}</span>
                    {(p.promoted as boolean) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 uppercase font-bold">Promoted</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.category as string} · ${Number(p.price_usd).toFixed(2)} · by {(p.vendor as string) ?? "—"}</div>
                </div>
                <button
                  onClick={async () => { setBusy(id); await promFn({ data: { productId: id, promoted: !(p.promoted as boolean) } }); refresh(); setBusy(null); }}
                  disabled={busy === id}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300"
                  aria-label="Toggle promoted"
                >
                  <Star className={`w-4 h-4 ${p.promoted ? "fill-amber-300" : ""}`} />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
                    setBusy(id); await delFn({ data: { productId: id } }); refresh(); setBusy(null);
                  }}
                  disabled={busy === id}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300"
                  aria-label="Delete product"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
