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
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string>("");

  if (!open) return null;

  const reset = () => {
    setName(""); setVendor(""); setDescription(""); setPriceUSD("");
    setFile(null); setExternalUrl(""); setMode("file"); setProgress("");
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
    if (!vendor.trim()) return toast.error("Vendor name required");
    if (!description.trim()) return toast.error("Description required");
    const usd = Number(priceUSD);
    if (!(usd > 0)) return toast.error("Price must be greater than 0");
    if (mode === "file" && !file) return toast.error("Attach a digital file to sell");
    if (mode === "url" && !/^https?:\/\//i.test(externalUrl.trim()))
      return toast.error("Provide a valid https:// delivery URL");

    setSubmitting(true);
    try {
      let filePath: string | null = null;
      if (mode === "file" && file) {
        setProgress("Uploading asset...");
        const { data: userData, error: uErr } = await supabase.auth.getUser();
        if (uErr || !userData.user) throw new Error("You must be signed in to sell.");
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${userData.user.id}/${Date.now()}-${safe}`;
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
                  accept=".zip,.rar,.7z,.tar,.gz,.pdf,.png,.jpg,.jpeg,.svg,.mp4,.mp3,.psd,.fig,.sketch,.json,.txt,.md" />
                {file ? (
                  <div className="text-sm text-white">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB — click to replace</div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    <Upload className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                    Drop a file or click to browse. Max {MAX_FILE_MB}MB.
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
