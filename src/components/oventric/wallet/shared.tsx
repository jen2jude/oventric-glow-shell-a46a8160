import { useEffect, type ReactNode } from "react";
import { X, CheckCircle2, Clock3, AlertTriangle } from "lucide-react";
import { currencySymbol } from "@/lib/fx-display";
import { CURRENCY_META } from "@/lib/currency/africa";

export type TxStatus = "success" | "pending" | "failed";

export type CurMeta = {
  symbol: string;
  label: string;
  glow: string;
  ring: string;
  text: string;
  dot: string;
};

export const CURRENCY_STYLES: Record<string, CurMeta> = {
  USD: {
    symbol: "$",
    label: "US Dollar",
    glow: "",
    ring: "border-sky-500/40",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  NGN: {
    symbol: "₦",
    label: "Nigerian Naira",
    glow: "",
    ring: "border-emerald-500/40",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  GHS: {
    symbol: "₵",
    label: "Ghanaian Cedi",
    glow: "",
    ring: "border-amber-500/40",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
};

/** Style + symbol for ANY supported currency, falling back to a neutral theme. */
export const currencyMeta = new Proxy({} as Record<string, CurMeta>, {
  get: (_t, key: string | symbol) => {
    if (typeof key !== "string") return undefined;
    return (
      CURRENCY_STYLES[key] ?? {
        symbol: currencySymbol(key),
        label: CURRENCY_META[key]?.name ?? key,
        glow: "",
        ring: "border-slate-500/40",
        text: "text-slate-300 md:text-slate-600",
        dot: "bg-slate-400",
      }
    );
  },
});

export function StatusBadge({ status }: { status: TxStatus }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
        <CheckCircle2 className="w-3 h-3" /> Success
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[10px] border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 animate-pulse">
        <Clock3 className="w-3 h-3" /> Pending Escrow
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[10px] border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
      <AlertTriangle className="w-3 h-3" /> Failed
    </span>
  );
}

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, []);
  return (
    <div
      className="modal-light fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#141418] md:bg-white md:shadow-sm border border-[#222226] md:border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl slide-up max-h-[90vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 border-b border-[#222226] md:border-slate-200">
          <h3 className="truncate text-base font-bold text-white md:text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-[10px] hover:bg-white/5 text-slate-400 md:text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}
