import { useEffect, useRef, useState } from "react";
import { X, Upload, Link2, Loader2, CheckCircle2, ImagePlus, Trash2, ShieldAlert, Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createProduct, listMarketplaceCategories, estimateSellerNetUSD, FX_FROM_USD, type ProductCategory, type CategoryNode, type OrderCurrency } from "@/lib/marketplace.functions";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const FALLBACK_CATEGORIES: CategoryNode[] = [
  { id: "themes", slug: "themes", name: "Themes", description: "", kind: "digital", parentId: null, sortOrder: 10, children: [] },
  { id: "plugins", slug: "plugins", name: "Plugins", description: "", kind: "digital", parentId: null, sortOrder: 20, children: [] },
  { id: "blocks", slug: "blocks", name: "Blocks", description: "", kind: "digital", parentId: null, sortOrder: 30, children: [] },
  { id: "scripts", slug: "scripts", name: "Scripts", description: "", kind: "digital", parentId: null, sortOrder: 40, children: [] },
];

const MAX_FILE_MB = 50;
const MAX_IMAGE_MB = 10;
const MAX_IMAGES = 5;

export function SellAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const persist = useServerFn(createProduct);
  const snapshotFx = useServerFn(snapshotFxRates);
  const loadCats = useServerFn(listMarketplaceCategories);
  const [categories, setCategories] = useState<CategoryNode[]>(FALLBACK_CATEGORIES);
  const { baseCurrency } = useOnboarding();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("themes");
  const [subcategory, setSubcategory] = useState<string>("");
  useEffect(() => {
    loadCats()
      .then((rows) => {
        const digital = (rows ?? []).filter((r) => r.kind === "digital");
        if (digital.length > 0) {
          setCategories(digital);
          setCategory((prev) => (digital.some((d) => d.slug === prev) ? prev : digital[0].slug));
        }
      })
      .catch(() => {});
  }, [loadCats]);

  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [requiresManualDelivery, setRequiresManualDelivery] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [success, setSuccess] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const reset = () => {
    setName(""); setDescription(""); setPriceInput(""); setDiscountInput(""); setIsFree(false);
    setFile(null); setExternalUrl(""); setMode("file"); setProgress("");
    setRequiresManualDelivery(false);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages([]); setPreviews([]); setSuccess(false);
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name} is not an image`); continue; }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) { toast.error(`${f.name} over ${MAX_IMAGE_MB}MB`); continue; }
      valid.push(f);
    }
    const next = [...images, ...valid].slice(0, MAX_IMAGES);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
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
    if (images.length < 1) return toast.error("Add at least 1 product image (first is cover)");
    const mainLocal = isFree ? 0 : Number(priceInput);
    const discountLocal = isFree ? 0 : (discountInput.trim() ? Number(discountInput) : 0);
    if (!isFree && !(mainLocal > 0)) return toast.error("Enter a main price greater than 0 or mark as free");
    if (!isFree && discountLocal > 0 && discountLocal >= mainLocal)
      return toast.error("Discount price must be lower than the main price");
    const priceLocal = discountLocal > 0 ? discountLocal : mainLocal;
    if (mode === "file" && !file) return toast.error("Attach a digital file to sell");
    if (mode === "url" && !/^https?:\/\//i.test(externalUrl.trim()))
      return toast.error("Provide a valid https:// delivery URL");

    setSubmitting(true);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) throw new Error("You must be signed in to sell.");
      const uid = userData.user.id;
      const email = userData.user.email ?? "";
      const { data: prof } = await supabase
        .from("profiles").select("display_name, username").eq("user_id", uid).maybeSingle();
      const vendorName =
        (prof?.display_name && String(prof.display_name).trim()) ||
        (prof?.username && String(prof.username).trim()) ||
        (email ? email.split("@")[0] : "") || "Member";

      setProgress(`Uploading images (0/${images.length})…`);
      const imagePaths: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const safe = img.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        setProgress(`Uploading “${img.name}” (${i + 1}/${images.length})…`);
        const { error: uErr2 } = await supabase.storage
          .from("product-covers").upload(path, img, { contentType: img.type, upsert: false });
        if (uErr2) throw new Error(uErr2.message);
        imagePaths.push(path);
      }

      let filePath: string | null = null;
      if (mode === "file" && file) {
        setProgress("Uploading asset file…");
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("product-files").upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error(upErr.message);
        filePath = path;
      }

      setProgress("Locking market rate…");
      const snapshot = await snapshotFx();
      const rate = Number(snapshot.rates[baseCurrency] ?? 1);
      const priceUSD = isFree ? 0 : (baseCurrency === "USD" ? priceLocal : Number((priceLocal / rate).toFixed(2)));

      const fmtLocal = (n: number) =>
        new Intl.NumberFormat(undefined, { style: "currency", currency: baseCurrency, maximumFractionDigits: 2 }).format(n);
      const noteLines: string[] = [];
      if (discountLocal > 0) noteLines.push(`🏷️ On sale — was ${fmtLocal(mainLocal)}, now ${fmtLocal(discountLocal)}`);
      const fullDescription = noteLines.length > 0
        ? `${noteLines.join("\n")}\n\n${description.trim()}`
        : description.trim();

      setProgress("Submitting for review…");
      await persist({
        data: {
          name: name.trim(),
          category,
          subcategory: subcategory || null,

          description: fullDescription,
          priceUSD,
          originalCurrency: baseCurrency,
          originalAmount: priceLocal,
          fxSnapshot: snapshot,
          vendor: vendorName,
          externalUrl: mode === "url" ? externalUrl.trim() : null,
          filePath,
          coverPath: imagePaths[0] ?? null,
          imagePaths,
          requiresManualDelivery,
        },
      });
      setSuccess(true);
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
      <div className="slide-up relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Submitted for review</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-3">
              Your asset has been submitted. Our system is scanning it for malware and verifying licensing.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              If the product is not genuine, missing a valid license, nulled, or contains malware, it will be rejected and the poster may be banned. Only upload genuine products with valid GPL/commercial licenses.
            </p>
            <button onClick={() => { reset(); onClose(); }} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg">OK</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Sell a Digital Asset</h2>
                <p className="text-xs text-slate-400 mt-1">List your digital product in the marketplace. Reviewed by admin before going live.</p>
              </div>
              <button onClick={onClose} disabled={submitting} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-40" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Every submission is scanned for malware and verified for licensing. Nulled, pirated, or malicious uploads are rejected and posters may be banned. Only upload genuine products with valid licenses (GPL or commercial).
              </p>
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
                  <select value={category} onChange={(e) => { setCategory(e.target.value as ProductCategory); setSubcategory(""); }}
                    className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60">
                    {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              {(() => {
                const chosen = categories.find((c) => c.slug === category);
                if (!chosen || chosen.children.length === 0) return null;
                return (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-300">Subcategory (optional)</span>
                    <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60">
                      <option value="">— None —</option>
                      {chosen.children.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
                    </select>
                  </label>
                );
              })()}
              


              <div>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="accent-emerald-500" />
                  This is a free product
                </label>
                {!isFree && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300">Main price ({baseCurrency})</span>
                      <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} inputMode="decimal" placeholder="29.00"
                        className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-300">Discount price ({baseCurrency}) <span className="text-slate-500">— optional</span></span>
                      <input value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} inputMode="decimal" placeholder="Lower than main"
                        className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none" />
                    </label>
                  </div>
                )}
                {!isFree && Number(priceInput) > 0 && (() => {
                  const cur = baseCurrency as OrderCurrency;
                  const fx = FX_FROM_USD[cur] || 1;
                  const priceLocal = Number(priceInput);
                  const priceUSD = priceLocal / fx;
                  // Show worst-case (card/gateway) net so sellers plan for it.
                  const netUSD = estimateSellerNetUSD(priceUSD, cur, "card", fx);
                  const netLocal = netUSD * fx;
                  const walletNetUSD = estimateSellerNetUSD(priceUSD, cur, "wallet", fx);
                  const walletNetLocal = walletNetUSD * fx;
                  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
                  return (
                    <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>You'll receive (card/bank/mobile money)</span>
                        <span className="font-semibold text-emerald-300">{fmt(netLocal)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-slate-400">
                        <span>You'll receive (wallet buyer)</span>
                        <span className="font-medium text-emerald-200/80">{fmt(walletNetLocal)}</span>
                      </div>
                      <div className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                        Buyer pays exactly {fmt(priceLocal)}. Oventric absorbs the gateway fee into the split — 80% goes to you, 20% to Oventric, and the Paystack processing fee is skimmed off the top before the split. Price your product accordingly.
                      </div>
                    </div>
                  );
                })()}
              </div>


              <label className="block">
                <span className="text-xs font-medium text-slate-300">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="What buyers get, tech stack, key features…"
                  className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/60 outline-none resize-none" />
              </label>

              <div>
                <span className="text-xs font-medium text-slate-300">Product images (up to {MAX_IMAGES}, first is cover)</span>
                <label className="mt-2 flex items-center gap-3 border border-dashed border-white/15 rounded-lg p-3 cursor-pointer hover:border-emerald-500/60">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
                  <div className="w-16 h-16 rounded-md bg-[#121214] border border-white/10 flex items-center justify-center text-emerald-400">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-400">Click to add images. PNG/JPG up to {MAX_IMAGE_MB}MB each. {images.length}/{MAX_IMAGES} added.</div>
                </label>
                {previews.length > 0 && (
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {previews.map((src, i) => (
                      <div key={i} className={`relative aspect-square rounded-md overflow-hidden border ${i === 0 ? "border-emerald-500/60" : "border-white/10"}`}>
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {i === 0 && <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-emerald-500/90 text-black rounded px-1">Cover</span>}
                        <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white hover:bg-red-500/80">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

              <label className="flex items-start gap-2 text-sm text-slate-200 p-3 rounded-lg bg-[#121214] border border-white/10">
                <input type="checkbox" checked={requiresManualDelivery} onChange={(e) => setRequiresManualDelivery(e.target.checked)} className="mt-0.5 accent-emerald-500" />
                <span>
                  <span className="block font-medium">Requires manual delivery / setup</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Check this if the buyer needs custom deployment (SaaS setup, provisioning, license issuance) instead of an instant download. We’ll collect their email and WhatsApp at checkout so you can deliver.</span>
                </span>
              </label>

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
                    {submitting ? "Submitting…" : "Submit for review"}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
