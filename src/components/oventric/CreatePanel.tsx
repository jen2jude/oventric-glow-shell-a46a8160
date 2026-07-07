import { X, PenSquare, Target, ShoppingBag, FileText } from "lucide-react";

const choices = [
  { icon: PenSquare, title: "Drop a Post", desc: "Share updates with the community" },
  { icon: Target, title: "Post a Bounty ($)", desc: "Get expert help, pay on delivery" },
  { icon: ShoppingBag, title: "Sell an Asset", desc: "List digital goods in the marketplace" },
  { icon: FileText, title: "Add Blog Article", desc: "Publish long-form technical writing" },
];

export function CreatePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="slide-up relative w-full max-w-2xl bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Something</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {choices.map((c) => (
            <button
              key={c.title}
              className="group text-left p-4 bg-[#121214] border border-white/10 rounded-xl hover:border-emerald-500/60 hover:bg-[#161618] transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
                <c.icon className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="font-semibold text-white">{c.title}</div>
              <div className="text-xs text-slate-400 mt-1">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
