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
  LayoutDashboard,
  Target,
  GraduationCap,
  Wallet as WalletIcon,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Bell,
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
import {
  getDashboardOverview,
  listMyBounties,
  listMyCourses,
  getMyWalletSummary,
  getMySocial,
  type DashboardOverview,
  type DashboardBountyPosted,
  type DashboardBountySolved,
  type DashboardEnrolledCourse,
  type DashboardPublishedCourse,
  type DashboardWalletSummary,
  type DashboardSocial,
} from "@/lib/dashboard.functions";
import { toast } from "sonner";
import { EditListingModal } from "@/components/oventric/EditListingModal";


export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Dashboard — Oventric" },
      { name: "description", content: "Manage your Oventric activity — purchases, listings, bounties, courses, wallet, and social." },
    ],
  }),
  component: DashboardPage,
});

type Tab = "overview" | "bounties" | "courses" | "wallet" | "social" | "digital" | "physical" | "listings";

function DashboardPage() {
  const navigate = useNavigate();
  const purchasesFn = useServerFn(listMyPurchases);
  const contactsFn = useServerFn(listMyContactedSellers);
  const listingsFn = useServerFn(listMyProducts);
  const orderFn = useServerFn(getOrderWithDownload);
  const logFn = useServerFn(logProductContact);
  const overviewFn = useServerFn(getDashboardOverview);
  const bountiesFn = useServerFn(listMyBounties);
  const coursesFn = useServerFn(listMyCourses);
  const walletFn = useServerFn(getMyWalletSummary);
  const socialFn = useServerFn(getMySocial);

  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDTO[] | null>(null);
  const [contacts, setContacts] = useState<ContactedSellerDTO[] | null>(null);
  const [listings, setListings] = useState<ProductDTO[] | null>(null);
  const [bounties, setBounties] = useState<{ posted: DashboardBountyPosted[]; solved: DashboardBountySolved[] } | null>(null);
  const [courses, setCourses] = useState<{ enrolled: DashboardEnrolledCourse[]; published: DashboardPublishedCourse[] } | null>(null);
  const [walletSummary, setWalletSummary] = useState<DashboardWalletSummary | null>(null);
  const [social, setSocial] = useState<DashboardSocial | null>(null);
  const [editing, setEditing] = useState<ProductDTO | null>(null);
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

  const loadListings = useCallback(async () => {
    try { setListings(await listingsFn()); }
    catch (e) { toast.error((e as Error).message); setListings([]); }
  }, [listingsFn]);

  const loadOverview = useCallback(async () => {
    try { setOverview(await overviewFn()); }
    catch (e) { toast.error((e as Error).message); }
  }, [overviewFn]);

  const loadBounties = useCallback(async () => {
    try { setBounties(await bountiesFn()); }
    catch (e) { toast.error((e as Error).message); setBounties({ posted: [], solved: [] }); }
  }, [bountiesFn]);

  const loadCourses = useCallback(async () => {
    try { setCourses(await coursesFn()); }
    catch (e) { toast.error((e as Error).message); setCourses({ enrolled: [], published: [] }); }
  }, [coursesFn]);

  const loadWallet = useCallback(async () => {
    try { setWalletSummary(await walletFn()); }
    catch (e) { toast.error((e as Error).message); }
  }, [walletFn]);

  const loadSocial = useCallback(async () => {
    try { setSocial(await socialFn()); }
    catch (e) { toast.error((e as Error).message); }
  }, [socialFn]);

  useEffect(() => {
    if (!authChecked) return;
    if (tab === "overview" && overview === null) void loadOverview();
    if (tab === "digital" && purchases === null) void loadPurchases();
    if (tab === "physical" && contacts === null) void loadContacts();
    if (tab === "listings" && listings === null) void loadListings();
    if (tab === "bounties" && bounties === null) void loadBounties();
    if (tab === "courses" && courses === null) void loadCourses();
    if (tab === "wallet" && walletSummary === null) void loadWallet();
    if (tab === "social" && social === null) void loadSocial();
  }, [authChecked, tab, overview, purchases, contacts, listings, bounties, courses, walletSummary, social, loadOverview, loadPurchases, loadContacts, loadListings, loadBounties, loadCourses, loadWallet, loadSocial]);

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, () => {
        void loadListings();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [authChecked, loadContacts, loadPurchases, loadListings]);


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
    listings: listings?.length ?? 0,
    listingsPending: listings?.filter((l) => l.status === "pending").length ?? 0,
    listingsActive: listings?.filter((l) => l.status === "active").length ?? 0,
    listingsRejected: listings?.filter((l) => l.status === "rejected").length ?? 0,
  }), [purchases, contacts, listings]);

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
          <p className="text-slate-400 mt-1 text-sm">Your full Oventric hub — wallet, bounties, courses, marketplace and social.</p>
        </header>

        <div className="flex flex-wrap gap-1 rounded-xl bg-[#141418] border border-white/10 p-1 mb-5">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            <LayoutDashboard className="w-4 h-4" /> Overview
          </TabButton>
          <TabButton active={tab === "bounties"} onClick={() => setTab("bounties")}>
            <Target className="w-4 h-4" /> Bounties
          </TabButton>
          <TabButton active={tab === "courses"} onClick={() => setTab("courses")}>
            <GraduationCap className="w-4 h-4" /> Courses
          </TabButton>
          <TabButton active={tab === "wallet"} onClick={() => setTab("wallet")}>
            <WalletIcon className="w-4 h-4" /> Wallet
          </TabButton>
          <TabButton active={tab === "digital"} onClick={() => setTab("digital")}>
            <Package className="w-4 h-4" /> Digital Purchases
          </TabButton>
          <TabButton active={tab === "physical"} onClick={() => setTab("physical")}>
            <ShoppingBag className="w-4 h-4" /> Contacted Sellers
          </TabButton>
          <TabButton active={tab === "listings"} onClick={() => setTab("listings")}>
            <Store className="w-4 h-4" /> My Listings
            {stats.listingsRejected > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {stats.listingsRejected}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "social"} onClick={() => setTab("social")}>
            <Users className="w-4 h-4" /> Social
          </TabButton>
        </div>

        {tab === "overview" && <OverviewPane overview={overview} onGoto={setTab} />}
        {tab === "bounties" && <BountiesPane data={bounties} />}
        {tab === "courses" && <CoursesPane data={courses} />}
        {tab === "wallet" && <WalletPane data={walletSummary} />}
        {tab === "digital" && (
          <DigitalList rows={purchases} downloadingId={downloadingId} onDownload={handleDownload} />
        )}
        {tab === "physical" && <PhysicalList rows={contacts} onRelog={relogContact} />}
        {tab === "listings" && (
          <ListingsList
            rows={listings}
            counts={{ pending: stats.listingsPending, active: stats.listingsActive, rejected: stats.listingsRejected }}
            onEdit={(p) => setEditing(p)}
          />
        )}
        {tab === "social" && <SocialPane data={social} />}
      </div>


      {editing && (
        <EditListingModal
          product={editing}
          onClose={() => setEditing(null)}
          onResubmitted={() => { void loadListings(); }}
        />
      )}
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

function ListingStatusBadge({ status }: { status: ProductDTO["status"] }) {
  const meta = {
    pending: { label: "Pending review", cls: "bg-amber-500/10 border-amber-400/40 text-amber-300", icon: Clock },
    active: { label: "Live", cls: "bg-emerald-500/10 border-emerald-400/40 text-emerald-300", icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-red-500/10 border-red-400/40 text-red-300", icon: AlertTriangle },
  }[status] ?? { label: status, cls: "bg-white/10 border-white/20 text-slate-300", icon: AlertTriangle };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.cls}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function ListingsList({
  rows,
  counts,
  onEdit,
}: {
  rows: ProductDTO[] | null;
  counts: { pending: number; active: number; rejected: number };
  onEdit: (p: ProductDTO) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected">("all");

  if (rows === null) {
    return <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="You haven't published any listings yet"
        hint="Tap the + button on the home screen to sell a digital asset or physical product."
        cta={<Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold">Go to marketplace</Link>}
      />
    );
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const chips: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "active", label: "Live", count: counts.active },
    { key: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              filter === c.key
                ? "bg-emerald-500 border-emerald-400 text-black"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            {c.label}
            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
              filter === c.key ? "bg-black/20 text-black" : "bg-white/10 text-slate-200"
            }`}>{c.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#111114] p-8 text-center text-sm text-slate-500">
          No listings in this bucket.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex gap-3">
              <Link to="/product/$id" params={{ id: p.id }} className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br ${p.hue}`}>
                {p.coverUrl ? <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover" /> : null}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 truncate">
                      {p.kind === "physical" ? "Physical" : "Digital"} · {p.category}
                    </div>
                    <Link to="/product/$id" params={{ id: p.id }} className="text-sm font-bold text-white hover:text-emerald-300 truncate block">
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-400">
                      ${p.priceUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      {p.location ? <span className="ml-2 inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.location}</span> : null}
                    </div>
                  </div>
                  <ListingStatusBadge status={p.status} />
                </div>

                {p.status === "rejected" && p.rejectReason && (
                  <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-0.5">Moderator note</div>
                    <div className="text-xs text-amber-100 whitespace-pre-wrap break-words line-clamp-4">{p.rejectReason}</div>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.status === "rejected" && (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit & Resubmit
                    </button>
                  )}
                  {p.status === "active" && (
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" /> View live
                    </Link>
                  )}
                  {p.status === "pending" && (
                    <span className="text-[11px] text-slate-500">Awaiting admin approval.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

