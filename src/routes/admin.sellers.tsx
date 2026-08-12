import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Search,
  CheckCircle,
  AlertTriangle,
  Ban,
  Star,
  ExternalLink,
  MoreVertical,
  Filter,
  Check,
  X,
  ShieldCheck,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { 
  listAdminUsers, 
  verifySeller, 
  suspendSeller, 
  featureSeller 
} from "@/lib/admin.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";

export const Route = createFileRoute("/admin/sellers")({
  head: () => ({
    meta: [{ title: "Sellers · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SellersPage,
});

type Row = Record<string, any>;

function SellersPage() {
  const listFn = useServerFn(listAdminUsers);
  const verifyFn = useServerFn(verifySeller);
  const suspendFn = useServerFn(suspendSeller);
  const featureFn = useServerFn(featureSeller);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "pending" | "flagged">("all");

  const refresh = useCallback(async () => {
    try {
      const r = await listFn();
      // Sellers are users with products or specific flags, but for now we list all profiles 
      // and filter by those who have commercial activity or intent.
      setRows(r as Row[]);
    } catch (e) {
      toast.error("Failed to load sellers");
    }
  }, [listFn]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter(r => {
      if (filter === "verified" && !r.kyc_completed_at) return false;
      if (filter === "pending" && (r.verification_tier !== "TIER_0" || r.kyc_completed_at)) return false;
      if (filter === "flagged" && !r.flagged) return false;
      
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.username?.toLowerCase().includes(s) ||
        r.display_name?.toLowerCase().includes(s) ||
        r.user_id.toLowerCase().includes(s)
      );
    });
  }, [rows, q, filter]);

  const handleVerify = async (userId: string, tier: string) => {
    setBusy(userId);
    try {
      await verifyFn({ data: { userId, tier } });
      toast.success("Seller verified");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleFeature = async (userId: string, featured: boolean) => {
    setBusy(userId);
    try {
      await featureFn({ data: { userId, featured } });
      toast.success(featured ? "Featured" : "Unfeatured");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl font-black">Sellers</h1>
          <p className="text-sm text-slate-400">Manage marketplace merchants and verification.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sellers..."
              className="bg-[#141418] border border-white/10 rounded-[10px] pl-9 pr-4 py-2 text-sm text-white w-64 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </header>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["all", "verified", "pending", "flagged"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-[10px] text-xs font-bold border transition-colors whitespace-nowrap ${
              filter === f
                ? "bg-emerald-500 text-black border-emerald-500"
                : "bg-[#141418] border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {!rows ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#141418] border border-white/10 rounded-2xl">
          <p className="text-slate-500">No sellers found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.user_id} className="bg-[#141418] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-xl font-black text-white">
                    {s.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <h3 className="text-white font-bold leading-tight">
                      {s.display_name ?? s.username ?? "Unknown"}
                    </h3>
                    <p className="text-xs text-slate-500">@{s.username ?? "no-handle"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {s.kyc_completed_at && (
                    <div title="Verified" className="p-1.5 rounded-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  )}
                  {s.is_featured && (
                    <div title="Featured" className="p-1.5 rounded-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Award className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Tier</div>
                  <div className="text-sm text-white font-black">{s.verification_tier ?? "NONE"}</div>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Stars</div>
                  <div className="text-sm text-white font-black flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {s.reputation_stars ?? 0}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!s.kyc_completed_at ? (
                  <button
                    onClick={() => handleVerify(s.user_id, "TIER_1")}
                    disabled={busy === s.user_id}
                    className="flex-1 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-colors disabled:opacity-50"
                  >
                    Verify Tier 1
                  </button>
                ) : (
                   <button
                    onClick={() => handleFeature(s.user_id, !s.is_featured)}
                    disabled={busy === s.user_id}
                    className={`flex-1 py-2 rounded-[10px] text-xs font-black transition-colors disabled:opacity-50 border ${
                      s.is_featured 
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-200" 
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {s.is_featured ? "Unfeature" : "Feature Seller"}
                  </button>
                )}
                
                <button
                  disabled={busy === s.user_id}
                  className="px-3 py-2 rounded-[10px] bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
