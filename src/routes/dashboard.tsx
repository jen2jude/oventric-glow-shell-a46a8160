import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Package,
  Download,
  ExternalLink,
  MessageCircle,
  Phone,
  ShoppingBag,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Store,
  Pencil,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyPurchases,
  listMyContactedSellers,
  listMyProducts,
  getOrderWithDownload,
  logProductContact,
  type PurchaseDTO,
  type ContactedSellerDTO,
  type ProductDTO,
} from "@/lib/marketplace.functions";
import { toast } from "sonner";
import { EditListingModal } from "@/components/oventric/EditListingModal";


export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Dashboard — Oventric" },
      { name: "description", content: "Manage your marketplace activity — digital downloads and physical seller conversations." },
    ],
  }),
  component: DashboardPage,
});

type Tab = "digital" | "physical";

function DashboardPage() {
  const navigate = useNavigate();
  const purchasesFn = useServerFn(listMyPurchases);
  const contactsFn = useServerFn(listMyContactedSellers);
  const orderFn = useServerFn(getOrderWithDownload);
  const logFn = useServerFn(logProductContact);

  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("digital");
  const [purchases, setPurchases] = useState<PurchaseDTO[] | null>(null);
  const [contacts, setContacts] = useState<ContactedSellerDTO[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) {
        navigate({ to: "/" });
        return;
      }
      setAuthChecked(true);
    });
    return () => { alive = false; };
  }, [navigate]);

  const loadPurchases = useCallback(async () => {
    try { setPurchases(await purchasesFn()); }
    catch (e) { toast.error((e as Error).message); setPurchases([]); }
  }, [purchasesFn]);

  const loadContacts = useCallback(async () => {
    try { setContacts(await contactsFn()); }
    catch (e) { toast.error((e as Error).message); setContacts([]); }
  }, [contactsFn]);

  useEffect(() => {
    if (!authChecked) return;
    if (tab === "digital" && purchases === null) void loadPurchases();
    if (tab === "physical" && contacts === null) void loadContacts();
  }, [authChecked, tab, purchases, contacts, loadPurchases, loadContacts]);

  // Realtime: refresh contacts when a new contact log lands for this user
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("dashboard-contacts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "product_contacts" }, () => {
        void loadContacts();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        void loadPurchases();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [authChecked, loadContacts, loadPurchases]);

  const handleDownload = async (orderId: string, productId: string, externalUrl: string | null, hasFile: boolean) => {
    setDownloadingId(orderId);
    try {
      const res = await orderFn({ data: { orderId } });
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      } else if (externalUrl) {
        window.open(externalUrl, "_blank", "noopener,noreferrer");
      } else if (!hasFile) {
        toast.info("No file attached", { description: "This product has no downloadable file. Open the product page for details." });
        navigate({ to: "/product/$id", params: { id: productId } });
      } else {
        toast.error("Download link unavailable", { description: "Order may still be processing. Please try again shortly." });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const relogContact = async (productId: string, method: "call" | "whatsapp") => {
    try { await logFn({ data: { productId, method } }); } catch { /* silent */ }
  };

  const stats = useMemo(() => ({
    digital: purchases?.filter((p) => p.status === "paid").length ?? 0,
    pending: purchases?.filter((p) => p.status === "pending").length ?? 0,
    contacts: contacts?.length ?? 0,
  }), [purchases, contacts]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back home
        </button>

        <header className="mb-6">
          <h1 className="text-white text-3xl font-black">My Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm">Your marketplace activity — digital downloads and seller conversations.</p>
        </header>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={Download} label="Downloads" value={stats.digital} accent="text-emerald-300" />
          <StatCard icon={Clock} label="Pending orders" value={stats.pending} accent="text-amber-300" />
          <StatCard icon={MessageCircle} label="Sellers contacted" value={stats.contacts} accent="text-sky-300" />
        </div>

        <div className="inline-flex rounded-xl bg-[#141418] border border-white/10 p-1 mb-5">
          <TabButton active={tab === "digital"} onClick={() => setTab("digital")}>
            <Package className="w-4 h-4" /> Digital Purchases
          </TabButton>
          <TabButton active={tab === "physical"} onClick={() => setTab("physical")}>
            <ShoppingBag className="w-4 h-4" /> Contacted Sellers
          </TabButton>
        </div>

        {tab === "digital" ? (
          <DigitalList
            rows={purchases}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        ) : (
          <PhysicalList rows={contacts} onRelog={relogContact} />
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Package; label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141418] p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        <Icon className={`w-3.5 h-3.5 ${accent}`} /> {label}
      </div>
      <div className={`mt-1 text-2xl font-black ${accent}`}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active ? "bg-emerald-500 text-black" : "text-slate-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, title, hint, cta }: { icon: typeof Package; title: string; hint: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#111114] p-10 text-center">
      <Icon className="w-8 h-8 text-slate-600 mx-auto mb-3" />
      <div className="text-white font-bold">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{hint}</div>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseDTO["status"] }) {
  const meta = {
    paid: { label: "Paid", cls: "bg-emerald-500/10 border-emerald-400/40 text-emerald-300", icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-amber-500/10 border-amber-400/40 text-amber-300", icon: Clock },
    failed: { label: "Failed", cls: "bg-red-500/10 border-red-400/40 text-red-300", icon: AlertTriangle },
    refunded: { label: "Refunded", cls: "bg-white/10 border-white/20 text-slate-300", icon: AlertTriangle },
  }[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.cls}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function DigitalList({
  rows,
  downloadingId,
  onDownload,
}: {
  rows: PurchaseDTO[] | null;
  downloadingId: string | null;
  onDownload: (orderId: string, productId: string, externalUrl: string | null, hasFile: boolean) => void;
}) {
  if (rows === null) {
    return <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No digital purchases yet"
        hint="Your purchased digital products will appear here so you can re-download them anytime."
        cta={<Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold">Browse Marketplace</Link>}
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.orderId} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex gap-3">
          <Link to="/product/$id" params={{ id: r.productId }} className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br ${r.hue}`}>
            {r.coverUrl ? <img src={r.coverUrl} alt={r.productName} className="w-full h-full object-cover" /> : null}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate">{r.category}</div>
                <Link to="/product/$id" params={{ id: r.productId }} className="text-sm font-bold text-white hover:text-emerald-300 truncate block">
                  {r.productName}
                </Link>
                <div className="text-xs text-slate-400 truncate">by {r.vendor}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400">
                {r.displayCurrency} {r.displayTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {new Date(r.paidAt ?? r.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                {r.status === "paid" && (r.hasFile || r.externalUrl) && (
                  <button
                    onClick={() => onDownload(r.orderId, r.productId, r.externalUrl, r.hasFile)}
                    disabled={downloadingId === r.orderId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-60"
                  >
                    {downloadingId === r.orderId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : r.hasFile ? (
                      <Download className="w-3.5 h-3.5" />
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5" />
                    )}
                    {r.hasFile ? "Download" : "Open"}
                  </button>
                )}
                <Link
                  to="/order/$id"
                  params={{ id: r.orderId }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold"
                >
                  Receipt
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhysicalList({
  rows,
  onRelog,
}: {
  rows: ContactedSellerDTO[] | null;
  onRelog: (productId: string, method: "call" | "whatsapp") => void;
}) {
  if (rows === null) {
    return <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="You haven't contacted any sellers yet"
        hint="When you tap Call or Chat on a physical listing, it'll show up here so you can reach the seller again."
        cta={<Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold">Browse physical goods</Link>}
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const phone = (r.sellerPhone ?? "").replace(/\D/g, "");
        const wa = (r.whatsappNumber ?? phone).replace(/\D/g, "");
        const productUrl = typeof window !== "undefined" ? `${window.location.origin}/product/${r.productId}` : "";
        const message = `Hi! I'm still interested in your product "${r.productName}" on Oventric.\n\n${productUrl}`;
        const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : "";
        return (
          <div key={r.id} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex gap-3">
            <Link to="/product/$id" params={{ id: r.productId }} className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br ${r.hue}`}>
              {r.coverUrl ? <img src={r.coverUrl} alt={r.productName} className="w-full h-full object-cover" /> : null}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate">{r.category}</div>
                  <Link to="/product/$id" params={{ id: r.productId }} className="text-sm font-bold text-white hover:text-emerald-300 truncate block">
                    {r.productName}
                  </Link>
                  <div className="text-xs text-slate-400 truncate">by {r.vendor}</div>
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>{r.originalCurrency} {r.originalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                {r.location ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {r.location}</span> : null}
                <span className="inline-flex items-center gap-1">
                  {r.method === "call" ? <Phone className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                  Last via {r.method === "call" ? "Call" : "WhatsApp"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {phone.length >= 6 && (
                  <a
                    href={`tel:+${phone}`}
                    onClick={() => onRelog(r.productId, "call")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
                {wa && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onRelog(r.productId, "whatsapp")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                <Link
                  to="/product/$id"
                  params={{ id: r.productId }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold"
                >
                  View listing
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
