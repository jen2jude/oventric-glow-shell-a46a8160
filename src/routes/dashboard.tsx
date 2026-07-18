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
  confirmOrderReceived,
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
  const confirmFn = useServerFn(confirmOrderReceived);
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
    <div className="rounded-xl border border-white/10 bg-[#141418] p-3 flex items-center justify-between gap-3 md:block">
      {/* Mobile: single row — icon + label left, number in white right */}
      <div className="flex items-center gap-2 min-w-0 md:text-[10px] md:uppercase md:tracking-widest md:text-slate-500 md:font-bold">
        <Icon className={`w-4 h-4 shrink-0 ${accent} md:w-3.5 md:h-3.5`} />
        <span className="truncate text-sm text-slate-300 font-medium md:text-[10px] md:uppercase md:tracking-widest md:text-slate-500 md:font-bold">
          {label}
        </span>
      </div>
      <div className="shrink-0 text-lg font-black text-white md:mt-1 md:text-2xl">{value}</div>
    </div>
  );
}

function MobileOverviewRow({ icon: Icon, label, value, onClick }: { icon: typeof Package; label: string; value: string | number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-overview-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-slate-200">{label}</span>
      </span>
      <span className="shrink-0 text-base font-black text-white">{value}</span>
    </button>
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

/* -------------------------------------------------------------------------- */
/*  Overview                                                                   */
/* -------------------------------------------------------------------------- */

function OverviewPane({ overview, onGoto }: { overview: DashboardOverview | null; onGoto: (t: Tab) => void }) {
  if (!overview) return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  const w = overview.wallet;
  return (
    <div className="space-y-5">
      <div className="dashboard-overview-mobile-safe md:hidden" aria-label="Dashboard overview">
        <MobileOverviewRow icon={WalletIcon} label="Wallet balance" value={w ? `${w.currency} ${w.available.toFixed(2)}` : "—"} onClick={() => onGoto("wallet")} />
        <MobileOverviewRow icon={Trophy} label="Bounties earned" value={`$${overview.bounties.earnedUSD.toFixed(2)}`} onClick={() => onGoto("bounties")} />
        <MobileOverviewRow icon={Users} label="Network" value={overview.social.followers} onClick={() => onGoto("social")} />
        <MobileOverviewRow icon={Download} label="Downloads" value={overview.purchases.total} onClick={() => onGoto("digital")} />
        <MobileOverviewRow icon={Clock} label="Pending orders" value={overview.purchases.pending} onClick={() => onGoto("digital")} />
        <MobileOverviewRow icon={MessageCircle} label="Sellers contacted" value={overview.contacts} onClick={() => onGoto("physical")} />
        <MobileOverviewRow icon={Store} label="My listings" value={overview.listings.total} onClick={() => onGoto("listings")} />
        <MobileOverviewRow icon={GraduationCap} label="Enrolled courses" value={overview.courses.enrolled} onClick={() => onGoto("courses")} />
        <MobileOverviewRow icon={CheckCircle2} label="Completed courses" value={overview.courses.completed} onClick={() => onGoto("courses")} />
        <MobileOverviewRow icon={Target} label="Active bounties" value={overview.bounties.active} onClick={() => onGoto("bounties")} />
        <MobileOverviewRow icon={Bell} label="Unread notifications" value={overview.unread.notifications} onClick={() => onGoto("social")} />
      </div>

      <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
        <button onClick={() => onGoto("wallet")} className="text-left rounded-2xl border border-emerald-400/30 bg-[#141418] p-5 hover:border-emerald-400/60 transition">
          <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">Wallet balance</div>
          <div className="mt-2 text-3xl font-black text-white">
            {w ? `${w.currency} ${w.available.toFixed(2)}` : "—"}
          </div>
          <div className="text-xs text-slate-400 mt-1">{w ? `Escrow ${w.currency} ${w.escrow.toFixed(2)}` : "Wallet not initialized"}</div>
        </button>
        <button onClick={() => onGoto("bounties")} className="text-left rounded-2xl border border-white/10 bg-[#141418] p-5 hover:border-white/20 transition">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-300" /> Bounties earned</div>
          <div className="mt-2 text-3xl font-black text-amber-300">${overview.bounties.earnedUSD.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">{overview.bounties.solved} solved · {overview.bounties.posted} posted</div>
        </button>
        <button onClick={() => onGoto("social")} className="text-left rounded-2xl border border-white/10 bg-[#141418] p-5 hover:border-white/20 transition">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Network</div>
          <div className="mt-2 text-3xl font-black text-fuchsia-300">{overview.social.followers}</div>
          <div className="text-xs text-slate-400 mt-1">Followers · {overview.social.following} following · {overview.social.circles} circles</div>
        </button>
      </div>
      <div className="hidden grid-cols-1 gap-2 md:grid md:grid-cols-4 md:gap-3">
        <StatCard icon={Download} label="Downloads" value={overview.purchases.total} accent="text-emerald-300" />
        <StatCard icon={Clock} label="Pending orders" value={overview.purchases.pending} accent="text-amber-300" />
        <StatCard icon={MessageCircle} label="Sellers contacted" value={overview.contacts} accent="text-sky-300" />
        <StatCard icon={Store} label="My listings" value={overview.listings.total} accent="text-fuchsia-300" />
        <StatCard icon={GraduationCap} label="Enrolled courses" value={overview.courses.enrolled} accent="text-cyan-300" />
        <StatCard icon={CheckCircle2} label="Completed courses" value={overview.courses.completed} accent="text-emerald-300" />
        <StatCard icon={Target} label="Active bounties" value={overview.bounties.active} accent="text-amber-300" />
        <StatCard icon={Bell} label="Unread notifications" value={overview.unread.notifications} accent="text-rose-300" />
      </div>
    </div>
  );
}

function BountiesPane({ data }: { data: { posted: DashboardBountyPosted[]; solved: DashboardBountySolved[] } | null }) {
  const [sub, setSub] = useState<"posted" | "solved">("posted");
  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  return (
    <div>
      <div className="inline-flex rounded-lg bg-[#141418] border border-white/10 p-1 mb-4 gap-1">
        <TabButton active={sub === "posted"} onClick={() => setSub("posted")}>Posted by me ({data.posted.length})</TabButton>
        <TabButton active={sub === "solved"} onClick={() => setSub("solved")}>Solved by me ({data.solved.length})</TabButton>
      </div>
      {sub === "posted" && (
        data.posted.length === 0 ? (
          <EmptyState icon={Target} title="No bounties posted yet" hint="Post a bounty from the + menu to get expert help." />
        ) : (
          <div className="space-y-2">
            {data.posted.map((b) => (
              <div key={b.id} className="rounded-xl border border-white/10 bg-[#141418] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{b.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{b.category} · Created {new Date(b.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-300 font-black">${b.priceUSD.toFixed(2)}</div>
                  <div className={`text-[10px] font-bold uppercase mt-1 ${b.status === "active" ? "text-emerald-300" : b.status === "closed" ? "text-slate-400" : "text-amber-300"}`}>{b.status}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      {sub === "solved" && (
        data.solved.length === 0 ? (
          <EmptyState icon={Trophy} title="No bounties solved yet" hint="Payouts you receive as a solver will appear here." />
        ) : (
          <div className="space-y-2">
            {data.solved.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 bg-[#141418] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{s.title}</div>
                  <div className="text-xs text-slate-500 mt-1">Solved {new Date(s.solvedAt).toLocaleDateString()}</div>
                </div>
                <div className="text-emerald-300 font-black">+${s.payoutUSD.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function CoursesPane({ data }: { data: { enrolled: DashboardEnrolledCourse[]; published: DashboardPublishedCourse[] } | null }) {
  const [sub, setSub] = useState<"enrolled" | "published">("enrolled");
  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  return (
    <div>
      <div className="inline-flex rounded-lg bg-[#141418] border border-white/10 p-1 mb-4 gap-1">
        <TabButton active={sub === "enrolled"} onClick={() => setSub("enrolled")}>Enrolled ({data.enrolled.length})</TabButton>
        <TabButton active={sub === "published"} onClick={() => setSub("published")}>Published ({data.published.length})</TabButton>
      </div>
      {sub === "enrolled" && (
        data.enrolled.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No courses yet" hint="Enroll from Academy to see your progress here." />
        ) : (
          <div className="space-y-2">
            {data.enrolled.map((c) => {
              const pct = c.totalModules > 0 ? Math.round((c.completedModules / c.totalModules) * 100) : 0;
              return (
                <div key={c.id} className="rounded-xl border border-white/10 bg-[#141418] p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{c.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {c.completedModules}/{c.totalModules} modules · Enrolled {new Date(c.enrolledAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-emerald-300">{pct}%</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      {sub === "published" && (
        data.published.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No courses published" hint="Publish a course from the + menu to teach and earn." />
        ) : (
          <div className="space-y-2">
            {data.published.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-[#141418] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{c.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.isPublished ? <span className="text-emerald-300">Published</span> : <span className="text-amber-300">Draft</span>} · {c.enrollments} enrolled · Created {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-black">{c.isFree ? "Free" : `$${c.priceUSD.toFixed(2)}`}</div>
                  {c.revenueUSD > 0 && <div className="text-[10px] text-emerald-300 mt-1">${c.revenueUSD.toFixed(2)} earned</div>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function WalletPane({ data }: { data: DashboardWalletSummary | null }) {
  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.balances.length === 0 ? (
          <div className="md:col-span-2"><EmptyState icon={WalletIcon} title="No wallet yet" hint="Your wallet appears once you receive your first credit or fund it." /></div>
        ) : data.balances.map((b) => (
          <div key={b.currency} className="rounded-2xl border border-emerald-400/30 bg-[#141418] p-5">
            <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">{b.currency} balance</div>
            <div className="mt-2 text-3xl font-black text-white">{b.currency} {b.available.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">Escrow {b.currency} {b.escrow.toFixed(2)}</div>
          </div>
        ))}
      </div>
      {data.pendingPayouts.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Pending payouts</div>
          <div className="space-y-2">
            {data.pendingPayouts.map((p) => (
              <div key={p.id} className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">{p.currency} {p.amount.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.method.toUpperCase()} · Requested {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                <span className="text-[10px] font-bold uppercase text-amber-300">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Recent transactions</div>
        {data.recent.length === 0 ? (
          <EmptyState icon={WalletIcon} title="No transactions yet" hint="Sales, purchases and payouts will show here." />
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#141418] overflow-hidden divide-y divide-white/5">
            {data.recent.map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.inflow ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
                    {r.inflow ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{r.type}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{new Date(r.occurredAt).toLocaleString()} · {r.status}</div>
                  </div>
                </div>
                <div className={`font-black text-sm shrink-0 ${r.inflow ? "text-emerald-300" : "text-rose-300"}`}>{r.inflow ? "+" : "-"}{r.currency} {r.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SocialPane({ data }: { data: DashboardSocial | null }) {
  const [sub, setSub] = useState<"followers" | "following" | "circles">("followers");
  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  const rows = sub === "followers" ? data.followers : sub === "following" ? data.following : [];
  return (
    <div>
      <div className="inline-flex rounded-lg bg-[#141418] border border-white/10 p-1 mb-4 gap-1">
        <TabButton active={sub === "followers"} onClick={() => setSub("followers")}>Followers ({data.followers.length})</TabButton>
        <TabButton active={sub === "following"} onClick={() => setSub("following")}>Following ({data.following.length})</TabButton>
        <TabButton active={sub === "circles"} onClick={() => setSub("circles")}>My Circles ({data.circles.length})</TabButton>
      </div>
      {(sub === "followers" || sub === "following") && (
        rows.length === 0 ? (
          <EmptyState icon={Users} title={sub === "followers" ? "No followers yet" : "Not following anyone yet"} hint="Discover peers from the community and connect." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rows.map((u) => (
              <Link key={u.userId + u.at} to="/profile/$id" params={{ id: u.slug }} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex items-center gap-3 hover:border-emerald-400/40 transition">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-400/30 overflow-hidden flex items-center justify-center text-emerald-300 font-bold">
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{u.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">@{u.slug}</div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
      {sub === "circles" && (
        data.circles.length === 0 ? (
          <EmptyState icon={Users} title="No circles yet" hint="Join or create a circle to collaborate with peers." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.circles.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-400/30 flex items-center justify-center text-lg">{c.emoji ?? "◎"}</div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500">Joined {new Date(c.joinedAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase text-fuchsia-300">{c.role}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}


