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
import { listUserPhotos, type UserPhoto } from "@/lib/posts.functions";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";
import { Images } from "lucide-react";
import {
  OverviewSkeleton,
  ListSkeleton,
  WalletSkeleton,
  SocialSkeleton,
  ListingsSkeleton,
  DigitalSkeleton,
  PhysicalSkeleton,
} from "@/components/oventric/skeletons";



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
      <div
        className="max-w-5xl mx-auto px-4 py-8"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingTop: "max(2rem, calc(env(safe-area-inset-top) + 1rem))",
          paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1rem))",
        }}
      >
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

        <Link
          to="/ads-manager"
          className="group mb-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#141418] p-3 active:bg-white/[0.03]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold">Ads Manager</div>
              <div className="text-slate-400 text-xs">Manage and track your ad campaigns.</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
        </Link>


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
          <DigitalList rows={purchases} downloadingId={downloadingId} onDownload={handleDownload} onConfirm={async (orderId) => { try { await confirmFn({ data: { orderId } }); toast.success("Thanks! Seller funds released."); await loadPurchases(); } catch (e) { toast.error((e as Error).message); } }} />
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

function SimpleRowCard({
  icon: Icon,
  title,
  subtitle,
  value,
  onClick,
  href,
}: {
  icon: typeof Package;
  title: string;
  subtitle?: string;
  value?: string | number;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-white text-sm font-semibold truncate">{title}</div>
          {subtitle ? <div className="text-slate-400 text-xs truncate">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {value !== undefined ? <span className="text-sm font-black text-white">{value}</span> : null}
        <ArrowUpRight className="w-4 h-4 text-slate-400" />
      </div>
    </>
  );
  const cls = "group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#141418] p-3 active:bg-white/[0.03] w-full text-left";
  if (href) {
    return (
      <Link to={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function PremiumStatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
  hero,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  sub?: string;
  tone: "emerald" | "amber" | "fuchsia" | "sky" | "cyan" | "rose" | "violet";
  onClick: () => void;
  hero?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border border-white/10 bg-[#141418] p-4 text-left transition active:scale-[0.98] ${hero ? "col-span-2" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold leading-tight line-clamp-2 min-h-[1.6em]">{label}</div>
          <div className={`mt-1 font-black text-white ${hero ? "text-2xl" : "text-xl"} truncate`}>{value}</div>
          {sub ? <div className="mt-0.5 text-[11px] text-slate-400 leading-tight line-clamp-2">{sub}</div> : null}
        </div>
      </div>
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active ? "bg-white text-black" : "text-slate-300 hover:text-white"
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
    paid: { label: "Paid", icon: CheckCircle2 },
    pending: { label: "Pending", icon: Clock },
    failed: { label: "Failed", icon: AlertTriangle },
    refunded: { label: "Refunded", icon: AlertTriangle },
  }[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-slate-300">
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function DigitalList({
  rows,
  downloadingId,
  onDownload,
  onConfirm,
}: {
  rows: PurchaseDTO[] | null;
  downloadingId: string | null;
  onDownload: (orderId: string, productId: string, externalUrl: string | null, hasFile: boolean) => void;
  onConfirm: (orderId: string) => void;
}) {
  if (rows === null) {
    return <DigitalSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No digital purchases yet"
        hint="Your purchased digital products will appear here so you can re-download them anytime."
        cta={<Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-bold">Browse Marketplace</Link>}
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.orderId} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex gap-3">
          <Link to="/product/$id" params={{ id: r.productId }} className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
            {r.coverUrl ? <img src={r.coverUrl} alt={r.productName} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <ShoppingBag className="w-6 h-6 text-white/30" />}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{r.category}</div>
                <Link to="/product/$id" params={{ id: r.productId }} className="text-sm font-bold text-white hover:text-white truncate block">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-bold disabled:opacity-60"
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
                {r.status === "paid" && r.escrowStatus === "held" && (
                  <button
                    onClick={() => onConfirm(r.orderId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold"
                    title="Confirm you've received this product to release the seller's funds"
                  >
                    Confirm received
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
    return <PhysicalSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="You haven't contacted any sellers yet"
        hint="When you tap Call or Chat on a physical listing, it'll show up here so you can reach the seller again."
        cta={<Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-bold">Browse physical goods</Link>}
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
            <Link to="/product/$id" params={{ id: r.productId }} className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
              {r.coverUrl ? <img src={r.coverUrl} alt={r.productName} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <ShoppingBag className="w-6 h-6 text-white/30" />}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{r.category}</div>
                  <Link to="/product/$id" params={{ id: r.productId }} className="text-sm font-bold text-white hover:text-white truncate block">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-bold"
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
    pending: { label: "Pending review", icon: Clock },
    active: { label: "Live", icon: CheckCircle2 },
    rejected: { label: "Rejected", icon: AlertTriangle },
  }[status] ?? { label: status, icon: AlertTriangle };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-slate-300">
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
    return <ListingsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="You haven't published any listings yet"
        hint="Tap the + button on the home screen to sell a digital asset or physical product."
        cta={<Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-bold">Go to marketplace</Link>}
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
                ? "bg-white border-white/20 text-black"
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
              <Link to="/product/$id" params={{ id: p.id }} className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                {p.coverUrl ? <img src={p.coverUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <ShoppingBag className="w-6 h-6 text-white/30" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                      {p.kind === "physical" ? "Physical" : "Digital"} · {p.category}
                    </div>
                    <Link to="/product/$id" params={{ id: p.id }} className="text-sm font-bold text-white hover:text-white truncate block">
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
                  <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-0.5">Moderator note</div>
                    <div className="text-xs text-slate-200 whitespace-pre-wrap break-words line-clamp-4">{p.rejectReason}</div>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.status === "rejected" && (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-bold"
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
  // Lazy init so the first paint already picks the safe layout on mobile —
  // avoids a scrambled frame before useEffect runs. Any touch-primary narrow
  // viewport gets the safe overview; premium grid stays for pointer:fine (PC).
  const [useSafeOverview, setUseSafeOverview] = useState(() => {
    if (typeof window === "undefined") return true;
    // Simplified path for ALL mobile/tablet viewports. Premium grid is
    // desktop-only from now on.
    return window.matchMedia?.("(max-width: 1023px)").matches ?? true;
  });

  useEffect(() => {
    const lowGpu = shouldUseSafeDashboardOverview();
    if (lowGpu) {
      setUseSafeOverview(true);
      document.documentElement.classList.remove("high-gpu");
      document.documentElement.classList.add("low-gpu");
      document.documentElement.dataset.gpuTier = "low";
      document.documentElement.dataset.gpuReason ||= "dashboard-fallback";
    }
  }, []);

  if (!overview) return <OverviewSkeleton />;
  const w = overview.wallet;
  return (
    <div className="space-y-5">
      {/* Mobile: simplified flat rows, monochrome icons, no gradients / shadows / glow */}
      <div className="block md:hidden pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-2" aria-label="Dashboard overview">
        <SimpleRowCard
          icon={WalletIcon}
          title="Wallet balance"
          subtitle={w ? `Escrow ${w.currency} ${w.escrow.toFixed(2)}` : "Wallet not initialized"}
          value={w ? `${w.currency} ${w.available.toFixed(2)}` : "—"}
          onClick={() => onGoto("wallet")}
        />
        <SimpleRowCard
          icon={Trophy}
          title="Bounties earned"
          subtitle={`${overview.bounties.solved} solved · ${overview.bounties.posted} posted`}
          value={`$${overview.bounties.earnedUSD.toFixed(2)}`}
          onClick={() => onGoto("bounties")}
        />
        <SimpleRowCard
          icon={Users}
          title="Network"
          subtitle={`${overview.social.following} following · ${overview.social.circles} circles`}
          value={overview.social.followers}
          onClick={() => onGoto("social")}
        />
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={Download} label="Downloads" value={overview.purchases.total} accent="text-white" />
          <StatCard icon={Clock} label="Pending" value={overview.purchases.pending} accent="text-white" />
          <StatCard icon={MessageCircle} label="Contacted" value={overview.contacts} accent="text-white" />
          <StatCard icon={Store} label="Listings" value={overview.listings.total} accent="text-white" />
          <StatCard icon={GraduationCap} label="Enrolled" value={overview.courses.enrolled} accent="text-white" />
          <StatCard icon={CheckCircle2} label="Completed" value={overview.courses.completed} accent="text-white" />
          <StatCard icon={Target} label="Active" value={overview.bounties.active} accent="text-white" />
          <StatCard icon={Bell} label="Alerts" value={overview.unread.notifications} accent="text-white" />
        </div>
      </div>


      <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
        <button onClick={() => onGoto("wallet")} className="text-left rounded-2xl border border-white/10 bg-[#141418] p-5 hover:border-white/20 transition">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Wallet balance</div>
          <div className="mt-2 text-3xl font-black text-white">
            {w ? `${w.currency} ${w.available.toFixed(2)}` : "—"}
          </div>
          <div className="text-xs text-slate-400 mt-1">{w ? `Escrow ${w.currency} ${w.escrow.toFixed(2)}` : "Wallet not initialized"}</div>
        </button>
        <button onClick={() => onGoto("bounties")} className="text-left rounded-2xl border border-white/10 bg-[#141418] p-5 hover:border-white/20 transition">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1"><Trophy className="w-3 h-3 text-white" /> Bounties earned</div>
          <div className="mt-2 text-3xl font-black text-white">${overview.bounties.earnedUSD.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">{overview.bounties.solved} solved · {overview.bounties.posted} posted</div>
        </button>
        <button onClick={() => onGoto("social")} className="text-left rounded-2xl border border-white/10 bg-[#141418] p-5 hover:border-white/20 transition">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Network</div>
          <div className="mt-2 text-3xl font-black text-white">{overview.social.followers}</div>
          <div className="text-xs text-slate-400 mt-1">Followers · {overview.social.following} following · {overview.social.circles} circles</div>
        </button>
      </div>
      <div className="hidden grid-cols-1 gap-2 md:grid md:grid-cols-4 md:gap-3">
        <StatCard icon={Download} label="Downloads" value={overview.purchases.total} accent="text-white" />
        <StatCard icon={Clock} label="Pending orders" value={overview.purchases.pending} accent="text-white" />
        <StatCard icon={MessageCircle} label="Sellers contacted" value={overview.contacts} accent="text-white" />
        <StatCard icon={Store} label="My listings" value={overview.listings.total} accent="text-white" />
        <StatCard icon={GraduationCap} label="Enrolled courses" value={overview.courses.enrolled} accent="text-white" />
        <StatCard icon={CheckCircle2} label="Completed courses" value={overview.courses.completed} accent="text-white" />
        <StatCard icon={Target} label="Active bounties" value={overview.bounties.active} accent="text-white" />
        <StatCard icon={Bell} label="Unread notifications" value={overview.unread.notifications} accent="text-white" />
      </div>
    </div>
  );
}

function shouldUseSafeDashboardOverview() {
  if (typeof window === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("low-gpu")) return true;

  const ua = navigator.userAgent || "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (!isMobile || !isAndroid) return false;
  if (/Infinix|X6813|X68\d{2}|Note\s*11i|TECNO|itel|Nokia\s*C|Redmi\s*(9|A)|Realme\s*C/i.test(ua)) {
    return true;
  }
  if (root.classList.contains("high-gpu")) return false;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const memory = nav.deviceMemory || 0;
  const cores = nav.hardwareConcurrency || 0;
  const androidVersion = Number((ua.match(/Android\s+(\d+)/i) || [])[1] || 0);
  const dpr = window.devicePixelRatio || 1;
  const longScreen = Math.max(window.screen?.width || 0, window.screen?.height || 0);
  const physicalWidth = longScreen * dpr;
  const connection = nav.connection;

  let score = 0;
  if (!androidVersion || androidVersion <= 11) score -= 2;
  else if (androidVersion === 12) score -= 1;
  else if (androidVersion >= 14) score += 1;

  if (!memory) score -= 1;
  else if (memory <= 4) score -= 3;
  else if (memory <= 6) score -= 1;
  else if (memory >= 12) score += 2;
  else if (memory >= 8) score += 1;

  if (!cores) score -= 1;
  else if (cores <= 4) score -= 3;
  else if (cores <= 6) score -= 1;
  else if (cores >= 8) score += 1;

  if (physicalWidth >= 2400 && dpr >= 3) score += 1;
  else if (physicalWidth <= 1600 || dpr < 2) score -= 1;

  if (connection?.saveData) score -= 3;
  if (["slow-2g", "2g", "3g"].includes(connection?.effectiveType || "")) score -= 1;

  return !(score >= 5 && androidVersion >= 13 && memory >= 8 && cores >= 8);
}

function BountiesPane({ data }: { data: { posted: DashboardBountyPosted[]; solved: DashboardBountySolved[] } | null }) {
  const [sub, setSub] = useState<"posted" | "solved">("posted");
  if (!data) return <ListSkeleton count={6} />;
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
              <SimpleRowCard
                key={b.id}
                icon={Target}
                title={b.title}
                subtitle={`${b.category} · Created ${new Date(b.createdAt).toLocaleDateString()}`}
                value={`$${b.priceUSD.toFixed(2)}`}
                onClick={() => {}}
              />
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
              <SimpleRowCard
                key={s.id}
                icon={Trophy}
                title={s.title}
                subtitle={`Solved ${new Date(s.solvedAt).toLocaleDateString()}`}
                value={`+$${s.payoutUSD.toFixed(2)}`}
                onClick={() => {}}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function CoursesPane({ data }: { data: { enrolled: DashboardEnrolledCourse[]; published: DashboardPublishedCourse[] } | null }) {
  const [sub, setSub] = useState<"enrolled" | "published">("enrolled");
  if (!data) return <ListSkeleton count={6} />;
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
                    <div className="text-xs font-bold text-white">{pct}%</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-white transition-all" style={{ width: `${pct}%` }} />
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
                    {c.isPublished ? <span className="text-white">Published</span> : <span className="text-slate-300">Draft</span>} · {c.enrollments} enrolled · Created {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-black">{c.isFree ? "Free" : `$${c.priceUSD.toFixed(2)}`}</div>
                  {c.revenueUSD > 0 && <div className="text-[10px] text-slate-300 mt-1">${c.revenueUSD.toFixed(2)} earned</div>}
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
          <div key={b.currency} className="rounded-2xl border border-white/10 bg-[#141418] p-5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{b.currency} balance</div>
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
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">{p.currency} {p.amount.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.method.toUpperCase()} · Requested {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                <span className="text-[10px] font-bold uppercase text-slate-300">{p.status}</span>
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
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white">
                    {r.inflow ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{r.type}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{new Date(r.occurredAt).toLocaleString()} · {r.status}</div>
                  </div>
                </div>
                <div className="font-black text-sm shrink-0 text-white">{r.inflow ? "+" : "-"}{r.currency} {r.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SocialPane({ data }: { data: DashboardSocial | null }) {
  const [sub, setSub] = useState<"followers" | "following" | "circles" | "memories">("followers");
  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  const rows = sub === "followers" ? data.followers : sub === "following" ? data.following : [];
  return (
    <div>
      <div className="inline-flex rounded-lg bg-[#141418] border border-white/10 p-1 mb-4 gap-1">
        <TabButton active={sub === "followers"} onClick={() => setSub("followers")}>Followers ({data.followers.length})</TabButton>
        <TabButton active={sub === "following"} onClick={() => setSub("following")}>Following ({data.following.length})</TabButton>
        <TabButton active={sub === "circles"} onClick={() => setSub("circles")}>My Circles ({data.circles.length})</TabButton>
        <TabButton active={sub === "memories"} onClick={() => setSub("memories")}>My Memories</TabButton>
      </div>
      {sub === "memories" && <MyMemoriesGallery />}
      {(sub === "followers" || sub === "following") && (
        rows.length === 0 ? (
          <EmptyState icon={Users} title={sub === "followers" ? "No followers yet" : "Not following anyone yet"} hint="Discover peers from the community and connect." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rows.map((u) => (
              <Link key={u.userId + u.at} to="/profile/$id" params={{ id: u.slug }} className="rounded-xl border border-white/10 bg-[#141418] p-3 flex items-center gap-3 hover:border-white/20 transition">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-white font-bold">
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
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg">{c.emoji ?? "◎"}</div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500">Joined {new Date(c.joinedAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase text-slate-300">{c.role}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function MyMemoriesGallery() {
  const fetchPhotos = useServerFn(listUserPhotos);
  const [photos, setPhotos] = useState<UserPhoto[] | null>(null);
  const [lb, setLb] = useState<{ images: string[]; index: number } | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetchPhotos({ data: {} });
        if (!cancel) setPhotos(r.photos);
      } catch {
        if (!cancel) setPhotos([]);
      }
    })();
    return () => { cancel = true; };
  }, [fetchPhotos]);

  if (photos === null) {
    return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;
  }
  if (photos.length === 0) {
    return <EmptyState icon={Images} title="No memories yet" hint="Your uploaded photos will appear here as you share." />;
  }
  const urls = photos.map((p) => p.url);
  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
        {photos.map((p, i) => (
          <button
            key={p.url + i}
            type="button"
            onClick={() => setLb({ images: urls, index: i })}
            className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/40 group"
          >
            <img src={p.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
            {p.source !== "post" && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-black/70 border border-white/20 text-white">
                {p.source}
              </span>
            )}
          </button>
        ))}
      </div>
      {lb && <ImageLightbox images={lb.images} startIndex={lb.index} onClose={() => setLb(null)} />}
    </>
  );
}



