import { useState } from "react";
import { X, ImagePlus, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPhysicalProduct } from "@/lib/marketplace.functions";
import { snapshotFxRates } from "@/lib/fx.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

const CATEGORIES = [
  { value: "electronics", label: "Electronics", emoji: "🔌", subs: ["Phones", "Laptops", "Accessories", "Audio", "Cameras"] },
  { value: "fashion", label: "Fashion", emoji: "👗", subs: ["Men", "Women", "Kids", "Shoes", "Watches"] },
  { value: "home", label: "Home & Living", emoji: "🏠", subs: ["Furniture", "Appliances", "Decor", "Kitchen"] },
  { value: "beauty", label: "Beauty & Health", emoji: "💄", subs: ["Skincare", "Makeup", "Wellness", "Fragrance"] },
  { value: "vehicles", label: "Vehicles", emoji: "🚗", subs: ["Cars", "Bikes", "Parts", "Accessories"] },
  { value: "sports", label: "Sports & Outdoors", emoji: "🏀", subs: ["Fitness", "Outdoor", "Team Sports"] },
  { value: "other", label: "Other", emoji: "📦", subs: [] },
];

const CONDITIONS = ["Brand New", "Used", "Refurbished"];
const YN = ["Yes", "No", "Maybe"];
const MAX_IMAGE_MB = 50;

export function SellPhysicalModal({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished?: () => void }) {
  const persist = useServerFn(createPhysicalProduct);
  const snapshotFx = useServerFn(snapshotFxRates);
  const { baseCurrency } = useOnboarding();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [subcategory, setSubcategory] = useState<string>("");
  const [location, setLocation] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState("Brand New");
  const [description, setDescription] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [negotiable, setNegotiable] = useState("Yes");
  const [delivery, setDelivery] = useState("No");
  const [phone, setPhone] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<{ done: number; total: number } | null>(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const chosenCat = CATEGORIES.find((c) => c.value === category);
  const clearField = (k: string) => setFieldErrors((prev) => { if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  const fieldCls = (k: string, base: string) => `${base} ${fieldErrors[k] ? "border-red-400/60 focus:border-red-400/80" : ""}`;
  const FieldError = ({ k }: { k: string }) => fieldErrors[k] ? <span className="mt-1 block text-[11px] text-red-300">{fieldErrors[k]}</span> : null;

  const reset = () => {
    setTitle(""); setCategory(""); setSubcategory(""); setLocation("");
    setBrand(""); setCondition("Brand New"); setDescription(""); setPriceInput("");
    setNegotiable("Yes"); setDelivery("No"); setPhone(""); setSocialLink("");
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages([]); setPreviews([]); setSuccess(false); setFormError(""); setFieldErrors({}); setProgress(""); setProgressPct(0); setUploadStatus(null);
  };

  const fail = (message: string, description: string, field?: string) => {
    setProgress("");
    setProgressPct(0);
    setUploadStatus(null);
    setFormError(`${message} ${description}`);
    if (field) setFieldErrors((prev) => ({ ...prev, [field]: `${message}. ${description}` }));
    toast.error(message, { description });
  };

  const addImages = (files: FileList | null) => {
    setFormError("");
    clearField("images");
    if (!files) return;
    const list = Array.from(files);
    const valid: File[] = [];
    for (const f of list) {
      if (!f.type.startsWith("image/")) { fail("Only images allowed", `${f.name} is not an image file.`); continue; }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) { fail(`${f.name} exceeds ${MAX_IMAGE_MB}MB`, "Choose a smaller image before posting."); continue; }
      valid.push(f);
    }
    const next = [...images, ...valid].slice(0, 8);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    if (next.length > 0 && next.length < 3) {
      setProgress(`${next.length}/3 photos attached — add ${3 - next.length} more before posting.`);
    } else if (next.length >= 3) {
      setProgress(`${next.length} photos attached. Ready to post once the other fields are complete.`);
    }
  };

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const submit = async () => {
    if (submitting) return;
    setFormError("");
    setFieldErrors({});
    setProgress("Checking listing details...");
    setProgressPct(5);
    setUploadStatus(null);

    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Add a product title before posting.";
    if (!category) errors.category = "Pick the category that best fits your product.";
    if (!description.trim()) errors.description = "Describe the product for buyers.";
    if (images.length < 3) errors.images = `Upload at least 3 product images (you have ${images.length}). The first image will be the cover.`;
    const priceLocal = Number(priceInput);
    if (!(priceLocal > 0)) errors.price = `Enter a price greater than 0 in ${baseCurrency}.`;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) errors.phone = "Enter a valid phone number with country code (digits only).";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      setFormError(`Please fix the highlighted ${Object.keys(errors).length === 1 ? "field" : "fields"} below.`);
      setProgress("");
      setProgressPct(0);
      toast.error("Check the highlighted fields", { description: errors[firstKey] });
      // Scroll to first error
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-field="${firstKey}"]`) as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus?.();
      });
      return;
    }



    setSubmitting(true);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData.user) throw new Error("You must be signed in to sell.");
      const uid = userData.user.id;

      const { data: prof } = await supabase
        .from("profiles").select("display_name, username").eq("user_id", uid).maybeSingle();
      const vendorName = (prof?.display_name || prof?.username || userData.user.email?.split("@")[0] || "Member") as string;

      const total = images.length;
      setUploadStatus({ done: 0, total });
      setProgress(`Uploading images (0/${total})…`);
      setProgressPct(10);
      const paths: string[] = [];
      // Reserve 10%..80% of the bar for uploads
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const safe = img.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        setProgress(`Uploading “${img.name}” (${i + 1}/${total})…`);
        const { error } = await supabase.storage.from("product-covers").upload(path, img, { contentType: img.type, upsert: false });
        if (error) throw new Error(error.message);
        paths.push(path);
        const done = i + 1;
        setUploadStatus({ done, total });
        setProgressPct(10 + Math.round((done / total) * 70));
      }

      setUploadStatus(null);
      setProgress("Locking market rate (FX snapshot)…");
      setProgressPct(85);
      const snapshot = await snapshotFx();
      const rate = Number(snapshot.rates[baseCurrency] ?? 1);
      const priceUSD = baseCurrency === "USD" ? priceLocal : Number((priceLocal / rate).toFixed(2));

      setProgress("Submitting listing for review…");
      setProgressPct(95);
      await persist({
        data: {
          name: title.trim(),
          category,
          subcategory: subcategory || null,
          description: description.trim(),
          priceUSD,
          originalCurrency: baseCurrency,
          originalAmount: priceLocal,
          fxSnapshot: snapshot,
          vendor: vendorName,
          imagePaths: paths,
          condition,
          brand: brand.trim() || null,
          location: location.trim() || null,
          negotiable,
          delivery,
          sellerPhone: digits,
          whatsappNumber: digits,
          socialLink: socialLink.trim() || null,
        },
      });

      setProgressPct(100);
      setSuccess(true);
      onPublished?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try again.";
      setFormError(`Could not submit. ${message}`);
      toast.error("Could not submit", { description: message });
    } finally {
      setSubmitting(false);
      setProgress("");
      setProgressPct(0);
      setUploadStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="slide-up relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Submitted for review</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Your product has been published for review. It will go live once an admin approves it. You may be contacted if additional information is needed.
            </p>
            <button
              onClick={() => { reset(); onClose(); }}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg"
            >
              OK
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Post a Physical Product</h2>
                <p className="text-xs text-slate-400 mt-1">Buyers will contact you directly. Oventric does not mediate the transaction.</p>
              </div>
              <button onClick={onClose} disabled={submitting} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-300">Title</span>
                <input data-field="title" value={title} onChange={(e) => { setTitle(e.target.value); clearField("title"); }} placeholder="iPhone 15 Pro Max 256GB"
                  className={fieldCls("title", "mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60")} />
                <FieldError k="title" />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Category</span>
                  <select data-field="category" value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); clearField("category"); }}
                    className={fieldCls("category", "mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white")}>
                    <option value="">Select category…</option>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                  </select>
                  <FieldError k="category" />
                </label>
                {chosenCat && chosenCat.subs.length > 0 && (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-300">Subcategory</span>
                    <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                      <option value="">Optional</option>
                      {chosenCat.subs.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Location</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lagos, Nigeria"
                    className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Brand (optional)</span>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Apple"
                    className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60" />
                </label>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-300">Condition</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button type="button" key={c} onClick={() => setCondition(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        condition === c ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"
                      }`}>{c}</button>
                  ))}
                </div>
              </div>

              <div data-field="images" tabIndex={-1}>
                <span className="text-xs font-medium text-slate-300">Product images (min 3, first is cover)</span>
                <label className={`mt-2 flex items-center gap-3 border border-dashed rounded-lg p-3 cursor-pointer hover:border-emerald-500/60 ${fieldErrors.images ? "border-red-400/60" : "border-white/15"}`}>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
                  <div className="w-16 h-16 rounded-md bg-[#121214] border border-white/10 flex items-center justify-center text-emerald-400">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-400">Click to add images (up to 8). PNG/JPG/phone photos up to {MAX_IMAGE_MB}MB each.</div>
                </label>
                <FieldError k="images" />
                {previews.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
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

              <label className="block">
                <span className="text-xs font-medium text-slate-300">Facebook / YouTube link (optional)</span>
                <input value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="https://youtube.com/…"
                  className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60" />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-300">Description</span>
                <textarea data-field="description" value={description} onChange={(e) => { setDescription(e.target.value); clearField("description"); }} rows={4}
                  placeholder="Describe the product, specifications, what's included…"
                  className={fieldCls("description", "mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60 resize-none")} />
                <FieldError k="description" />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Price ({baseCurrency})</span>
                  <input data-field="price" value={priceInput} onChange={(e) => { setPriceInput(e.target.value); clearField("price"); }} inputMode="decimal" placeholder="0.00"
                    className={fieldCls("price", "mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60")} />
                  <FieldError k="price" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Phone number (digits only, incl. country code)</span>
                  <input data-field="phone" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); clearField("phone"); }} inputMode="numeric" placeholder="2348012345678"
                    className={fieldCls("phone", "mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60")} />
                  <FieldError k="phone" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-slate-300">Open to negotiation?</span>
                  <div className="mt-1 flex gap-2">
                    {YN.map((v) => (
                      <button type="button" key={v} onClick={() => setNegotiable(v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border ${negotiable === v ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-300">Offer delivery?</span>
                  <div className="mt-1 flex gap-2">
                    {YN.map((v) => (
                      <button type="button" key={v} onClick={() => setDelivery(v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border ${delivery === v ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" : "bg-[#121214] border-white/10 text-slate-300"}`}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 -mx-6 px-6 pb-1 pt-3 bg-[#1E1E24]/95 backdrop-blur border-t border-white/5">
                {(formError || progress) && (
                  <div
                    className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
                      formError
                        ? "border-red-400/30 bg-red-500/10 text-red-200"
                        : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                    role={formError ? "alert" : "status"}
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-2">
                      {submitting && !formError && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                      <span className="flex-1">{formError || progress}</span>
                      {!formError && progressPct > 0 && (
                        <span className="text-[10px] font-semibold tabular-nums text-emerald-300">{progressPct}%</span>
                      )}
                    </div>
                    {!formError && submitting && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-300 ease-out"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                    {!formError && uploadStatus && (
                      <div className="mt-1.5 text-[10px] text-emerald-300/80">
                        Image {uploadStatus.done} of {uploadStatus.total} uploaded
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400 min-h-[1rem]">{images.length}/3 required images</div>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} disabled={submitting}
                    className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm disabled:opacity-40">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void submit()} disabled={submitting} aria-busy={submitting} aria-label="Post physical product for approval"
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-60">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "Publishing…" : "Post product"}
                  </button>
                </div>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
