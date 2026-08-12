import { useEffect, type ReactNode } from "react";
import { X, Eye, Loader2 } from "lucide-react";

export interface TokenField {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  multiline?: boolean;
  accent?: "default" | "muted" | "warn" | "ok";
}

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  accent: "emerald" | "fuchsia" | "amber";
  fields: TokenField[];
  /** Optional visual preview card (rendered above the token dump). */
  visual?: ReactNode;
  confirmLabel: string;
  icon?: ReactNode;
  isSubmitting?: boolean;
}

const ACCENT_MAP = {
  emerald: {
    ring: "border-emerald-500/40",
    pill: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
    btn: "bg-emerald-500 hover:bg-emerald-400 text-black",
  },
  fuchsia: {
    ring: "border-fuchsia-500/40",
    pill: "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300",
    btn: "bg-fuchsia-500 hover:bg-fuchsia-400 text-black",
  },
  amber: {
    ring: "border-amber-500/40",
    pill: "bg-amber-500/15 border-amber-500/40 text-amber-300",
    btn: "bg-amber-500 hover:bg-amber-400 text-black",
  },
} as const;

function displayValue(v: TokenField["value"]): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export function PreviewModal({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  accent,
  fields,
  visual,
  confirmLabel,
  icon,
  isSubmitting = false,
}: PreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const styles = ACCENT_MAP[accent];

  return (
    <div className="modal-light fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={isSubmitting ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#1A1A1E] border ${styles.ring} rounded-2xl shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-white/5">
          <div className="flex items-start gap-3 min-w-0">
            {icon}
            <div className="min-w-0">
              <div
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mb-1.5 ${styles.pill}`}
              >
                <Eye className="w-3 h-3" /> Live Preview
              </div>
              <h2 className="text-white font-black text-base leading-tight truncate">{title}</h2>
              {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {visual}
          <div className="rounded-xl border border-white/10 bg-[#121214] overflow-hidden">
            <div className="px-3 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Exact Token Payload
            </div>
            <dl className="divide-y divide-white/5">
              {fields.map((f) => (
                <div key={f.label} className="grid grid-cols-3 gap-3 px-3 py-2">
                  <dt className="col-span-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
                    {f.label}
                  </dt>
                  <dd
                    className={`col-span-2 text-xs break-words ${f.mono ? "font-mono" : ""} ${
                      f.accent === "muted"
                        ? "text-slate-500"
                        : f.accent === "warn"
                          ? "text-amber-300"
                          : f.accent === "ok"
                            ? "text-emerald-300"
                            : "text-white"
                    } ${f.multiline ? "whitespace-pre-wrap" : ""}`}
                  >
                    {displayValue(f.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-3 rounded-[10px] bg-[#121214] border border-white/10 text-slate-300 hover:text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back to edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-3 rounded-[10px] text-xs font-black inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait ${styles.btn}`}
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSubmitting ? "Submitting…" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
