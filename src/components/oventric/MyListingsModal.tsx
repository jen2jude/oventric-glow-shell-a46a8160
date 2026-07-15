import { useCallback, useEffect, useState } from "react";
import { X, Loader2, Package, AlertTriangle, CheckCircle2, Clock, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { listMyProducts, type ProductDTO } from "@/lib/marketplace.functions";
import { EditListingModal } from "./EditListingModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_META = {
  pending: { label: "Pending review", cls: "bg-amber-500/10 border-amber-400/40 text-amber-300", icon: Clock },
  active: { label: "Live", cls: "bg-emerald-500/10 border-emerald-400/40 text-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-500/10 border-red-400/40 text-red-300", icon: AlertTriangle },
} as const;

/**
 * Seller-facing overview of the user's own product listings, grouped by status.
 * Rejected items expose an "Edit & Resubmit" action wired to EditListingModal.
 */
export function MyListingsModal({ open, onClose }: Props) {
  const fetchMine = useServerFn(listMyProducts);
  const [items, setItems] = useState<ProductDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchMine();
      setItems(rows);
    } catch (err) {
      toast.error("Couldn't load your listings", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchMine]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  if (!open) return null;

  const groups = {
    rejected: (items ?? []).filter((p) => p.status === "rejected"),
    pending: (items ?? []).filter((p) => p.status === "pending"),
    active: (items ?? []).filter((p) => p.status === "active"),
  };

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="slide-up relative w-full max-w-3xl max-h-[85dvh] sm:max-h-[90dvh] overflow-hidden bg-[#1E1E24] border border-white/10 rounded-2xl shadow-2xl flex flex-col">
          <header className="shrink-0 flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/5">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="truncate">My Listings</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Track approval status and resubmit rejected listings.</p>
            </div>
            <button onClick={onClose} className="shrink-0 p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your listings…
              </div>
            )}

            {!loading && items && items.length === 0 && (
              <div className="text-center py-10 text-sm text-slate-400">
                You haven't created any listings yet. Use the <span className="text-white">+</span> button to sell your first product.
              </div>
            )}

            {!loading && items && items.length > 0 && (
              <div className="space-y-6">
                {(["rejected", "pending", "active"] as const).map((key) => {
                  const list = groups[key];
                  if (list.length === 0) return null;
                  const meta = STATUS_META[key];
                  return (
                    <section key={key}>
                      <div className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border rounded-full px-2.5 py-1 mb-3 ${meta.cls}`}>
                        <meta.icon className="w-3 h-3" /> {meta.label} · {list.length}
                      </div>
                      <div className="space-y-3">
                        {list.map((p) => (
                          <ListingRow
                            key={p.id}
                            product={p}
                            onEdit={() => setEditing(p)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditListingModal
          product={editing}
          onClose={() => setEditing(null)}
          onResubmitted={() => {
            void reload();
          }}
        />
      )}
    </>
  );
}

function ListingRow({ product, onEdit }: { product: ProductDTO; onEdit: () => void }) {
  return (
    <div className="bg-[#121214] border border-white/10 rounded-xl p-3 flex gap-3">
      <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/5">
        {product.coverUrl ? (
          <img src={product.coverUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${product.hue} opacity-70`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{product.name}</div>
            <div className="text-[11px] text-slate-500">
              {product.kind === "physical" ? "Physical" : "Digital"} · {product.category}
              {product.location ? ` · ${product.location}` : ""}
            </div>
          </div>
          <div className="text-xs font-mono text-slate-300 shrink-0">${product.priceUSD.toFixed(2)}</div>
        </div>

        {product.status === "rejected" && product.rejectReason && (
          <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-0.5">Moderator note</div>
            <div className="text-xs text-amber-100 whitespace-pre-wrap break-words line-clamp-4">{product.rejectReason}</div>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {product.status === "rejected" && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit & Resubmit
            </button>
          )}
          {product.status === "active" && (
            <Link
              to="/product/$id"
              params={{ id: product.id }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5 text-xs"
            >
              View product
            </Link>
          )}
          {product.status === "pending" && (
            <span className="text-[11px] text-slate-500">Awaiting admin approval — you can view it here once it's live.</span>
          )}
        </div>
      </div>
    </div>
  );
}
