import { useEffect, useRef, useState } from "react";
import { X, ImagePlus, Loader2, Target, Calendar, Megaphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES = ["frontend", "database", "api", "uiux"] as const;
type Category = (typeof CATEGORIES)[number];
type PromoteTier = "text" | "banner" | "video";

interface FormState {
  title: string;
  description: string;
  category: Category;
  price_usd: string;
  applicant_limit: string;
  start_at: string;
  end_at: string;
  deadline_at: string;
  cover_path: string | null;
  cover_preview: string | null;
  promote: boolean;
  promote_tier: PromoteTier;
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
  cover_path: null,
  cover_preview: null,
  promote: false,
  promote_tier: "banner",
};

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function BountyEditorModal({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (!cancelled) setIsAdmin(!error && data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const reset = () => setForm(emptyForm);

  const handleCoverPick = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Cover must be an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploadingCover(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error("You must be signed in");
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage
        .from("bounty-covers")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("bounty-covers")
        .createSignedUrl(path, 60 * 60);
      setForm((f) => ({ ...f, cover_path: path, cover_preview: signed?.signedUrl ?? null }));
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const price = Number(form.price_usd);
    if (!(price >= 0)) return toast.error("Escrow must be >= 0");
    const limit = Number(form.applicant_limit);
    if (!(limit > 0)) return toast.error("Applicant limit must be > 0");
    const start = fromLocalInput(form.start_at);
    const end = fromLocalInput(form.end_at);
    const deadline = fromLocalInput(form.deadline_at);
    if (start && end && new Date(end) <= new Date(start)) {
      return toast.error("End time must be after start time");
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error("You must be signed in to post a bounty");
      const { error } = await supabase.from("bounties").insert({
        poster_id: uid,
        title: form.title.trim(),
        description: form.description,
        category: form.category,
        price_usd: price,
        applicant_limit: limit,
        cover_path: form.cover_path,
        start_at: start,
        end_at: end,
        deadline_at: deadline,
        status: "active",
      });
      if (error) throw error;
      toast.success("Bounty published");
      reset();
      onPublished?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#141418] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg inline-flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" /> Post a bounty
          </h2>
          <button
            onClick={onClose}
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
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCoverPick(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCover}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-white/15 hover:border-emerald-500/50 bg-black/20 hover:bg-black/30 disabled:opacity-50 text-left"
            >
              {form.cover_preview ? (
                <img src={form.cover_preview} alt="Cover preview" className="w-20 h-20 object-cover rounded-md border border-white/10" />
              ) : (
                <div className="w-20 h-20 rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-slate-500">
                  <ImagePlus className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0 text-xs">
                {uploadingCover ? (
                  <div className="flex items-center gap-2 text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</div>
                ) : form.cover_preview ? (
                  <>
                    <div className="text-slate-200 font-medium">Image attached</div>
                    <div className="text-slate-500 mt-0.5">Click to replace</div>
                  </>
                ) : (
                  <div className="text-slate-400">Click to upload a cover image (recommended 4:3).</div>
                )}
              </div>
              {form.cover_preview && !uploadingCover && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm((f) => ({ ...f, cover_path: null, cover_preview: null }));
                  }}
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
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="e.g. Fix Paystack webhook loop"
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              className={inputCls}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Escrow (USD)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price_usd}
                onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Applicant limit">
              <input
                type="number"
                min="1"
                step="1"
                value={form.applicant_limit}
                onChange={(e) => setForm({ ...form, applicant_limit: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                  value={form.start_at}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Ends (listing)">
                <input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Deadline (delivery)">
                <input
                  type="datetime-local"
                  value={form.deadline_at}
                  onChange={(e) => setForm({ ...form, deadline_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Start/End control when the bounty is visible on the public board. Deadline is the delivery due date shown to applicants.
            </p>
          </div>

          <p className="text-[11px] text-slate-500">
            Promoted placements are reserved for admin campaigns. Your bounty goes live on the public board immediately.
          </p>

          <div className="flex gap-2 pt-3">
            <button
              disabled={saving}
              onClick={save}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold rounded-lg flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Publish bounty
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
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
