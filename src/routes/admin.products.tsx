import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Star, Trash2, Pencil, Plus, X, ImagePlus, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllProducts,
  deleteProductAdmin,
  setProductPromoted,
  adminCreateProduct,
  adminUpdateProduct,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ProductsPage,
});

type Row = Record<string, unknown>;

const CATEGORIES = ["themes", "plugins", "blocks", "scripts"] as const;

interface FormState {
  id?: string;
  name: string;
  category: string;
  description: string;
  price_usd: string;
  vendor: string;
  external_url: string;
  promoted: boolean;
  cover_path: string | null;
  cover_preview: string | null;
  file_path: string | null;
  file_name: string | null;
}

const emptyForm: FormState = {
  name: "",
  category: "themes",
  description: "",
  price_usd: "",
  vendor: "",
  external_url: "",
  promoted: false,
  cover_path: null,
  cover_preview: null,
  file_path: null,
  file_name: null,
};

const MAX_ASSET_MB = 50;

function ProductsPage() {
  const listFn = useServerFn(listAllProducts);
  const delFn = useServerFn(deleteProductAdmin);
  const promFn = useServerFn(setProductPromoted);
  const createFn = useServerFn(adminCreateProduct);
  const updateFn = useServerFn(adminUpdateProduct);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    listFn().then((r) => setRows(r as Row[]));
  }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  const openCreate = () => setModal({ ...emptyForm });
  const openEdit = async (p: Row) => {
    const coverPath = (p.cover_path as string) ?? null;
    let coverPreview: string | null = null;
    if (coverPath) {
      const { data: signed } = await supabase.storage
        .from("product-covers")
        .createSignedUrl(coverPath, 60 * 60);
      coverPreview = signed?.signedUrl ?? null;
    }
    setModal({
      id: p.id as string,
      name: (p.name as string) ?? "",
      category: (p.category as string) ?? "themes",
      description: (p.description as string) ?? "",
      price_usd: String(p.price_usd ?? ""),
      vendor: (p.vendor as string) ?? "",
      external_url: (p.external_url as string) ?? "",
      promoted: Boolean(p.promoted),
      cover_path: coverPath,
      cover_preview: coverPreview,
    });
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

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
        .from("product-covers")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("product-covers")
        .createSignedUrl(path, 60 * 60);
      setModal((m) => m ? { ...m, cover_path: path, cover_preview: signed?.signedUrl ?? null } : m);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const save = async () => {
    if (!modal) return;
    if (!modal.name.trim()) return toast.error("Name is required");
    const price = Number(modal.price_usd);
    if (!(price > 0)) return toast.error("Price must be > 0");
    setSaving(true);
    try {
      if (modal.id) {
        await updateFn({ data: {
          id: modal.id,
          name: modal.name,
          category: modal.category,
          description: modal.description,
          price_usd: price,
          vendor: modal.vendor,
          external_url: modal.external_url || null,
          cover_path: modal.cover_path,
          promoted: modal.promoted,
        } });
        toast.success("Product updated");
      } else {
        await createFn({ data: {
          name: modal.name,
          category: modal.category,
          description: modal.description,
          price_usd: price,
          vendor: modal.vendor,
          external_url: modal.external_url || null,
          cover_path: modal.cover_path,
          promoted: modal.promoted,
        } });
        toast.success("Product created");
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
          <h1 className="text-white text-2xl font-black">Products</h1>
          <p className="text-sm text-slate-400">{rows?.length ?? 0} listings</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New product
        </button>
      </header>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : rows.length === 0 ? (
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
                    {(p.promoted as boolean) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 uppercase font-bold">
                        Promoted
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.category as string} · ${Number(p.price_usd).toFixed(2)} · by {(p.vendor as string) ?? "—"}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setBusy(id);
                    try { await promFn({ data: { id, promoted: !(p.promoted as boolean) } }); refresh(); }
                    catch (e) { toast.error((e as Error).message); }
                    setBusy(null);
                  }}
                  disabled={busy === id}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300"
                  aria-label="Toggle promoted"
                >
                  <Star className={`w-4 h-4 ${p.promoted ? "fill-amber-300" : ""}`} />
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
                  aria-label="Edit product"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
                    setBusy(id);
                    try { await delFn({ data: { id } }); refresh(); toast.success("Deleted"); }
                    catch (e) { toast.error((e as Error).message); }
                    setBusy(null);
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141418] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-black text-lg">
                {modal.id ? "Edit product" : "New product"}
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
                <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Product image</span>
                <p className="text-[11px] text-slate-500 -mt-0.5 mb-2">Shown as the cover on marketplace cards. PNG/JPG/WebP, up to 5MB.</p>
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
                    <img src={modal.cover_preview} alt="Cover preview" className="w-20 h-20 object-cover rounded-md border border-white/10" />
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

              <Field label="Name">
                <input
                  value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })}
                  className={inputCls}
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
                <Field label="Price (USD)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modal.price_usd}
                    onChange={(e) => setModal({ ...modal, price_usd: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Vendor">
                <input
                  value={modal.vendor}
                  onChange={(e) => setModal({ ...modal, vendor: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={modal.description}
                  onChange={(e) => setModal({ ...modal, description: e.target.value })}
                  rows={4}
                  className={inputCls}
                />
              </Field>
              <Field label="External download URL (optional)">
                <input
                  value={modal.external_url}
                  onChange={(e) => setModal({ ...modal, external_url: e.target.value })}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={modal.promoted}
                  onChange={(e) => setModal({ ...modal, promoted: e.target.checked })}
                  className="accent-emerald-500"
                />
                Promoted
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  disabled={saving}
                  onClick={save}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-lg flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {modal.id ? "Save changes" : "Create product"}
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
