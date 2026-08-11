import { useState } from "react";
import { X, ChevronRight, Globe, Cloud, LayoutGrid } from "lucide-react";
import { type CategoryNode } from "@/lib/marketplace.functions";

interface CategoryDiscoverySheetProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryNode[];
  onSelectCategory: (cat: CategoryNode) => void;
}

export function CategoryDiscoverySheet({
  open,
  onClose,
  categories,
  onSelectCategory,
}: CategoryDiscoverySheetProps) {
  const [activeKind, setActiveKind] = useState<"physical" | "digital">("physical");
  const [activeParent, setActiveParent] = useState<CategoryNode | null>(null);

  if (!open) return null;

  const filteredRoots = categories.filter((c) => c.kind === activeKind && !c.parentId);
  const currentLevel = activeParent ? activeParent.children : filteredRoots;

  const handleBack = () => {
    if (activeParent) {
      setActiveParent(null);
    } else {
      onClose();
    }
  };

  const handleSelect = (cat: CategoryNode) => {
    if (cat.children && cat.children.length > 0) {
      setActiveParent(cat);
    } else {
      onSelectCategory(cat);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-[#121214] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-8 border-b border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              {activeParent ? activeParent.name : "Categories"}
            </h2>
            <button 
              onClick={onClose}
              className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Type Switch */}
          {!activeParent && (
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
              <button
                onClick={() => setActiveKind("physical")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeKind === "physical" 
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/20" 
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Physical
              </button>
              <button
                onClick={() => setActiveKind("digital")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeKind === "digital" 
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/20" 
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                Digital
              </button>
            </div>
          )}

          {activeParent && (
            <button 
              onClick={handleBack}
              className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2 hover:translate-x-[-4px] transition-transform"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to all
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {currentLevel.length > 0 ? (
            currentLevel.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleSelect(cat)}
                className="w-full flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/0 hover:border-white/10 hover:bg-white/[0.07] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600/20 to-black border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LayoutGrid className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-black text-white uppercase tracking-widest mb-0.5">
                      {cat.name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {cat.children?.length > 0 ? `${cat.children.length} sub-categories` : 'Browse collection'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
              </button>
            ))
          ) : (
            <div className="py-20 text-center">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                No categories found for this selection
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-black/20 text-center">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
            Discovery powered by Oventric Global Index
          </p>
        </div>
      </div>
    </div>
  );
}
