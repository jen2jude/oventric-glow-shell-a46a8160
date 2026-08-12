import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createMyBannerAd, updateMyBannerAd } from "@/lib/my-ads-write.functions";

export interface BannerAdDraft {
  id?: string;
  title: string;
  header: string;
  body: string;
  media_url: string;
  cta_type: string;
  cta_url: string;
  cta_label: string;
  placements: string[];
}

export const EMPTY_BANNER: BannerAdDraft = {
  title: "",
  header: "",
  body: "",
  media_url: "",
  cta_type: "url",
  cta_url: "",
  cta_label: "Learn more",
  placements: ["feed"],
};

const PLACEMENTS = ["feed", "marketplace", "academy", "bounties"] as const;

const inputCls =
  "w-full rounded-[10px] bg-black/40 md:bg-white border border-white/10 md:border-slate-300 px-3 py-2 text-sm text-white md:text-slate-900 placeholder:text-slate-500 outline-none focus:border-emerald-500/60";

export function BannerAdModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: BannerAdDraft;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const createFn = useServerFn(createMyBannerAd);
  const updateFn = useServerFn(updateMyBannerAd);
  const [form, setForm] = useState<BannerAdDraft>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof BannerAdDraft>(k: K, v: BannerAdDraft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const togglePlacement = (p: string) =>
    setForm((f) => ({
      ...f,
      placements: f.placements.includes(p)
        ? f.placements.filter((x) => x !== p)
        : [...f.placements, p],
    }));

  const save = async () => {
    if (form.title.trim().length < 2) {
      toast.error("Give your ad a title");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        header: form.header.trim(),
        body: form.body.trim(),
        media_url: form.media_url.trim(),
        cta_type: form.cta_type,
        cta_url: form.cta_url.trim(),
        cta_label: form.cta_label.trim() || "Learn more",
        placements: form.placements,
      };
      if (form.id) await updateFn({ data: { ...payload, id: form.id } });
      else await createFn({ data: payload });
      toast.success(form.id ? "Banner ad updated" : "Banner ad created as draft");
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this ad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="modal-light relative w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-white/10 bg-[#141418] p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-white text-lg font-black">
              {form.id ? "Edit banner ad" : "New banner ad"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Tier 2 · sponsored banner placeholder</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Campaign title">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Summer promo"
            />
          </Field>
          <Field label="Headline">
            <input
              className={inputCls}
              value={form.header}
              onChange={(e) => set("header", e.target.value)}
              placeholder="Shown in bold on the banner"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={3}
              className={`${inputCls} resize-none`}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="One or two short lines"
            />
          </Field>
          <Field label="Banner image URL">
            <input
              className={inputCls}
              value={form.media_url}
              onChange={(e) => set("media_url", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          {form.media_url.trim() ? (
            <div className="rounded-[10px] overflow-hidden border border-white/10 md:border-slate-200 aspect-[16/6] bg-black/30">
              <img
                src={form.media_url}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-white/10 md:border-slate-300 aspect-[16/6] flex items-center justify-center text-slate-500 text-xs gap-2">
              <ImageIcon className="w-4 h-4" /> Banner preview
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA type">
              <select
                className={inputCls}
                value={form.cta_type}
                onChange={(e) => set("cta_type", e.target.value)}
              >
                <option value="url">Website link</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="lead_form">Lead form</option>
              </select>
            </Field>
            <Field label="CTA label">
              <input
                className={inputCls}
                value={form.cta_label}
                onChange={(e) => set("cta_label", e.target.value)}
              />
            </Field>
          </div>
          <Field label="CTA link">
            <input
              className={inputCls}
              value={form.cta_url}
              onChange={(e) => set("cta_url", e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Placements">
            <div className="flex flex-wrap gap-2">
              {PLACEMENTS.map((p) => {
                const on = form.placements.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlacement(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition ${
                      on
                        ? "bg-emerald-500 text-black border-emerald-500"
                        : "border-white/15 md:border-slate-300 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-[10px] border border-white/15 md:border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-[10px] bg-emerald-500 text-black px-4 py-2.5 text-sm font-bold hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {form.id ? "Save changes" : "Create ad"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
