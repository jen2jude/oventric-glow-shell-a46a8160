import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Star, Trash2, Pencil, Plus, X, ImagePlus, FileArchive, Check, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllProducts,
  deleteProductAdmin,
  setProductPromoted,
  adminCreateProduct,
  adminUpdateProduct,
  approveProduct,
  rejectProduct,
} from "@/lib/admin.functions";

import { ResponsiveImage } from "@/components/ui/responsive-image";
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
  const approveFn = useServerFn(approveProduct);
  const rejectFn = useServerFn(rejectProduct);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "rejected">("pending");
  const [kindFilter, setKindFilter] = useState<"all" | "digital" | "physical">("all");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectHint, setRejectHint] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listFn().then((r) => setRows(r as Row[]));
  }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = (rows ?? []).filter((p) => {
    if (statusFilter !== "all" && (p.status as string) !== statusFilter) return false;
    if (kindFilter !== "all" && ((p.kind as string) ?? "digital") !== kindFilter) return false;
    return true;
  });

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
    const filePath = (p.file_path as string) ?? null;
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
      file_path: filePath,
      file_name: filePath ? filePath.split("/").pop() ?? null : null,
    });
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);

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

  const handleAssetPick = async (file: File) => {
    if (!modal) return;
    if (file.size > MAX_ASSET_MB * 1024 * 1024) return toast.error(`Max ${MAX_ASSET_MB}MB`);
    setUploadingAsset(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id ?? "admin";
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage
        .from("product-files")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      setModal((m) => m ? { ...m, file_path: path, file_name: file.name } : m);
      toast.success("Product file uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingAsset(false);
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
          file_path: modal.file_path,
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
          file_path: modal.file_path,
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
          <p className="text-sm text-slate-400">{filtered.length} of {rows?.length ?? 0} listings</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New product
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "active", "rejected", "all"] as const).map((s) => {
          const count = s === "all" ? (rows?.length ?? 0) : (rows ?? []).filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === s ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#1E1E24] border-white/10 text-slate-300"}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} ({count})
            </button>
          );
        })}
        <span className="w-px h-6 bg-white/10 mx-1" />
        {(["all", "digital", "physical"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${kindFilter === k ? "bg-sky-500/15 border-sky-500/50 text-sky-300" : "bg-[#1E1E24] border-white/10 text-slate-300"}`}
          >
            {k === "all" ? "All types" : k.charAt(0).toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      {!rows ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No products in this view.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const id = p.id as string;
            const status = (p.status as string) ?? "active";
            const kind = (p.kind as string) ?? "digital";
            return (
              <div key={id} className="bg-[#141418] border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-bold truncate">{p.name as string}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${
                      status === "active" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" :
                      status === "pending" ? "bg-amber-500/15 border-amber-500/40 text-amber-200" :
                      "bg-red-500/15 border-red-500/40 text-red-300"
                    }`}>{status}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${kind === "physical" ? "bg-sky-500/15 border-sky-500/40 text-sky-300" : "bg-white/5 border-white/10 text-slate-400"}`}>{kind}</span>
                    {(p.promoted as boolean) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 uppercase font-bold">
                        Promoted
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.category as string} · ${Number(p.price_usd).toFixed(2)} · by {(p.vendor as string) ?? "—"}
                    {p.location ? ` · ${p.location as string}` : ""}
                  </div>
                  {status === "rejected" && p.reject_reason && (
                    <div className="text-[11px] text-red-300 mt-1 truncate">Reason: {p.reject_reason as string}</div>
                  )}
                </div>
                {status === "pending" && (
                  <>
                    <button
                      onClick={() => setPreviewId(id)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
                      aria-label="Preview"
                    ><Eye className="w-4 h-4" /></button>
                    <button
                      onClick={async () => {
                        setBusy(id);
                        try { await approveFn({ data: { id } }); toast.success("Approved"); refresh(); }
                        catch (e) { toast.error((e as Error).message); }
                        setBusy(null);
                      }}
                      disabled={busy === id}
                      className="px-3 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    ><Check className="w-3.5 h-3.5" /> Approve</button>
                    <button
                      onClick={() => { setRejectingId(id); setRejectReason(""); setRejectHint(""); }}
                      disabled={busy === id}
                      className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    ><XCircle className="w-3.5 h-3.5" /> Reject</button>
                  </>
                )}
                {kind === "digital" && (
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
                )}
                {kind === "digital" && (
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
                    aria-label="Edit product"
                  ><Pencil className="w-4 h-4" /></button>
                )}
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

      {rejectingId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#141418] border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-bold text-lg mb-3">Reject product</h3>
            <label className="block mb-3">
              <span className="text-xs text-slate-300">Reason (sent to seller)</span>
              <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1 w-full bg-[#0F0F12] border border-white/10 rounded-lg p-2 text-sm text-white" />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-slate-300">Recommendation (optional)</span>
              <textarea rows={2} value={rejectHint} onChange={(e) => setRejectHint(e.target.value)}
                className="mt-1 w-full bg-[#0F0F12] border border-white/10 rounded-lg p-2 text-sm text-white" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectingId(null)} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 text-sm">Cancel</button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) return toast.error("Reason is required");
                  const id = rejectingId;
                  setBusy(id);
                  try {
                    await rejectFn({ data: { id, reason: rejectReason.trim(), recommendation: rejectHint.trim() || undefined } });
                    toast.success("Rejected — seller notified");
                    setRejectingId(null);
                    refresh();
                  } catch (e) { toast.error((e as Error).message); }
                  setBusy(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold"
              >Send rejection</button>
            </div>
          </div>
        </div>
      )}

      {previewId && (() => {
        const p = (rows ?? []).find((r) => r.id === previewId);
        if (!p) return null;
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#141418] border border-white/10 rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-white font-bold text-lg">{p.name as string}</h3>
                <button onClick={() => setPreviewId(null)} className="p-1 hover:bg-white/5 rounded"><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="text-xs text-slate-400 mb-3">
                {String(p.kind ?? "digital")} · {String(p.category ?? "")} · ${Number(p.price_usd).toFixed(2)}
                {p.location ? ` · ${p.location as string}` : ""}
              </div>
              {p.description && <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{p.description as string}</p>}
              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                {p.brand ? <><dt className="text-slate-500">Brand</dt><dd>{p.brand as string}</dd></> : null}
                {p.condition ? <><dt className="text-slate-500">Condition</dt><dd>{p.condition as string}</dd></> : null}
                {p.negotiable ? <><dt className="text-slate-500">Negotiable</dt><dd>{p.negotiable as string}</dd></> : null}
                {p.delivery ? <><dt className="text-slate-500">Delivery</dt><dd>{p.delivery as string}</dd></> : null}
                {p.seller_phone ? <><dt className="text-slate-500">Phone</dt><dd>+{p.seller_phone as string}</dd></> : null}
              </dl>
            </div>
          </div>
        );
      })()}


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
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Product file (.zip)</span>
                <p className="text-[11px] text-slate-500 -mt-0.5 mb-2">Digital asset buyers download. ZIP/RAR/7Z or any file, up to {MAX_ASSET_MB}MB. Optional if you set an external URL above.</p>
                <input
                  ref={assetInputRef}
                  type="file"
                  accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAssetPick(f); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => assetInputRef.current?.click()}
                  disabled={uploadingAsset}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-white/15 hover:border-emerald-500/50 bg-black/20 hover:bg-black/30 disabled:opacity-50 text-left"
                >
                  <div className="w-12 h-12 rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-emerald-400">
                    <FileArchive className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    {uploadingAsset ? (
                      <div className="flex items-center gap-2 text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</div>
                    ) : modal.file_name ? (
                      <>
                        <div className="text-slate-200 font-medium truncate">{modal.file_name}</div>
                        <div className="text-slate-500 mt-0.5">Click to replace</div>
                      </>
                    ) : (
                      <div className="text-slate-400">Click to upload the product ZIP file (max {MAX_ASSET_MB}MB).</div>
                    )}
                  </div>
                  {modal.file_name && !uploadingAsset && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setModal((m) => m ? { ...m, file_path: null, file_name: null } : m); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setModal((m) => m ? { ...m, file_path: null, file_name: null } : m); } }}
                      className="p-1.5 rounded-md bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300"
                      aria-label="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              </div>
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
