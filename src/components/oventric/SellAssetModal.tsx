import { useState } from "react";
import { X, Upload, Link2, Loader2, CheckCircle2, ImagePlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createProduct, type ProductCategory } from "@/lib/marketplace.functions";

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "themes", label: "Themes" },
  { value: "plugins", label: "Plugins" },
  { value: "blocks", label: "Blocks" },
  { value: "scripts", label: "Scripts" },
];

const MAX_FILE_MB = 50;

export function SellAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const persist = useServerFn(createProduct);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("themes");
  const [description, setDescription] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string>("");

  if (!open) return null;

  const reset = () => {
    setName(""); setDescription(""); setPriceUSD("");
    setFile(null); setExternalUrl(""); setMode("file"); setProgress("");
    setCover(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  };

  const handleCover = (f: File | null) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    if (!f) { setCover(null); setCoverPreview(null); return; }
    if (!f.type.startsWith("image/")) { toast.error("Cover must be an image"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Cover image too large", { description: "Max 5MB." }); return; }
    setCover(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error("File too large", { description: `Max ${MAX_FILE_MB}MB per asset.` });
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return toast.error("Asset name required");
    if (!description.trim()) return toast.error("Description required");
    const usd = Number(priceUSD);
    if (!(usd > 0)) return toast.error("Price must be greater than 0");
    if (mode === "file" && !file) return toast.error("Attach a digital file to sell");
    if (mode === "url" && !/^https?:\/\//i.test(externalUrl.trim()))
      return toast.error("Provide a valid https:// delivery URL");

    setSubmitting(true);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) throw new Error("You must be signed in to sell.");
      const uid = userData.user.id;
      const email = userData.user.email ?? "";

      // Derive vendor display name from profile (display_name → username → email prefix).
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", uid)
        .maybeSingle();
      const vendorName =
        (prof?.display_name && String(prof.display_name).trim()) ||
        (prof?.username && String(prof.username).trim()) ||
        (email ? email.split("@")[0] : "") ||
        "Member";

      let coverPath: string | null = null;
      if (cover) {
        setProgress("Uploading cover image...");
        const safe = cover.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${safe}`;
        const { error: cErr } = await supabase.storage
          .from("product-covers")
          .upload(path, cover, { contentType: cover.type || undefined, upsert: false });
        if (cErr) throw new Error(cErr.message);
        coverPath = path;
      }

      let filePath: string | null = null;
      if (mode === "file" && file) {
        setProgress("Uploading asset...");
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("product-files")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error(upErr.message);
        filePath = path;
      }
      setProgress("Publishing listing...");
      const product = await persist({
        data: {
          name: name.trim(),
          category,
          description: description.trim(),
          priceUSD: usd,
          vendor: vendor.trim(),
          externalUrl: mode === "url" ? externalUrl.trim() : null,
          filePath,
          coverPath,
        },
      });
      toast.success("Asset listed", {
        description: `${product.name} is now live in the marketplace.`,
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      });
      reset();
      onClose();
      navigate({ to: "/product/$id", params: { id: product.id } });
    } catch (err) {
      toast.error("Listing failed", {
        description: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Sell an asset">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="slide-up relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Sell an Asset</h2>
            <p className="text-xs text-slate-400 mt-1">List your digital product in the marketplace. Buyers pay with wallet or card.</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Asset name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neon Analytics Dashboard"
                className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Vendor / studio name</span>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Your studio"
                className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Price (USD)</span>
              <input value={priceUSD} onChange={(e) => setPriceUSD(e.target.value)} inputMode="decimal" placeholder="29.00"
                className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-300">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="What buyers get, tech stack, key features..."
              className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none resize-none" />
          </label>

          <div>
            <span className="text-xs font-medium text-slate-300">Product image</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Displayed as the cover on marketplace cards and the product page. PNG/JPG, up to 5MB.</p>
            <label className="mt-2 flex items-center gap-3 border border-dashed border-white/15 rounded-lg p-3 cursor-pointer hover:border-emerald-500/60 transition-colors">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden"
                onChange={(e) => handleCover(e.target.files?.[0] ?? null)} />
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="Cover preview" className="w-20 h-20 object-cover rounded-md border border-white/10" />
                  <div className="text-xs text-slate-300 flex-1 min-w-0">
                    <div className="font-medium truncate">{cover?.name}</div>
                    <div className="text-slate-500 mt-0.5">{cover ? (cover.size / (1024 * 1024)).toFixed(2) : 0} MB — click to replace</div>
                  </div>
                  <button type="button" onClick={(e) => { e.preventDefault(); handleCover(null); }}
                    className="text-[11px] text-slate-400 hover:text-red-400 underline">Remove</button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-md bg-[#121214] border border-white/10 flex items-center justify-center text-emerald-400">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-400">Click to upload a product cover image (recommended 4:3).</div>
                </>
              )}
            </label>
          </div>


          <div>
            <span className="text-xs font-medium text-slate-300">Delivery</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode("file")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${mode === "file" ? "border-emerald-500/60 bg-emerald-500/10 text-white" : "border-white/10 bg-[#121214] text-slate-400 hover:text-white"}`}>
                <Upload className="w-4 h-4" /> Upload file
              </button>
              <button type="button" onClick={() => setMode("url")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${mode === "url" ? "border-emerald-500/60 bg-emerald-500/10 text-white" : "border-white/10 bg-[#121214] text-slate-400 hover:text-white"}`}>
                <Link2 className="w-4 h-4" /> External link
              </button>
            </div>

            {mode === "file" ? (
              <label className="mt-2 block border border-dashed border-white/15 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-500/60 transition-colors">
                <input type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed" />
                {file ? (
                  <div className="text-sm text-white">
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB — click to replace</div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    <Upload className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                    <div className="font-medium text-slate-200">Click to upload product ZIP file</div>
                    <div className="text-xs mt-1">ZIP / RAR / 7Z — max {MAX_FILE_MB}MB</div>
                  </div>
                )}
              </label>
            ) : (
              <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://your-delivery-link.com/download"
                className="mt-2 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none" />
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="text-xs text-slate-400 min-h-[1rem]">{progress}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={submitting}
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Publishing..." : "List asset"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
