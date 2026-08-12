import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Package, Cpu } from "lucide-react";
import { SellAssetModal } from "./SellAssetModal";
import { SellPhysicalModal } from "./SellPhysicalModal";

type Mode = "digital" | "physical" | null;

export function SellSwitcherModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  if (mode === "digital") {
    return (
      <SellAssetModal
        open
        onClose={() => {
          setMode(null);
          onClose();
        }}
      />
    );
  }
  if (mode === "physical") {
    return (
      <SellPhysicalModal
        open
        onClose={() => {
          setMode(null);
          onClose();
        }}
      />
    );
  }

  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[100] grid h-[100dvh] w-screen place-items-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-switcher-title"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="slide-up relative my-auto w-full max-w-lg bg-[#1E1E24] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <h2 id="sell-switcher-title" className="text-xl font-bold text-white">
            What are you selling?
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5">Choose the type of listing.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setMode("digital")}
            className="group text-left p-5 bg-[#121214] border border-white/10 rounded-xl hover:border-emerald-500/60 transition-all"
          >
            <div className="w-11 h-11 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="font-semibold text-white">Digital Assets</div>
            <div className="text-xs text-slate-400 mt-1">
              Themes, plugins, code, downloads. Goes live instantly.
            </div>
          </button>
          <button
            onClick={() => setMode("physical")}
            className="group text-left p-5 bg-[#121214] border border-white/10 rounded-xl hover:border-emerald-500/60 transition-all"
          >
            <div className="w-11 h-11 rounded-[10px] bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-3 group-hover:bg-sky-500/20">
              <Package className="w-5 h-5 text-sky-400" />
            </div>
            <div className="font-semibold text-white">Physical Goods</div>
            <div className="text-xs text-slate-400 mt-1">
              Sell directly — buyers contact you. Reviewed by admin.
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
