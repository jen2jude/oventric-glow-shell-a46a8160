import { useState } from "react";
import { Store, Megaphone, Target, Rocket, CheckCircle2, XCircle, Eye } from "lucide-react";
import { adminStore, type AdminCategory, type AdPlacement, type AdTier, type AdminCurrency } from "@/lib/admin/store";
import { AdminHistory } from "./AdminHistory";
import { PreviewModal, type TokenField } from "./AdminPreviewModal";

const CURRENCY_SYMBOL: Record<AdminCurrency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{children}</label>;
}

const inputCls =
  "w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60";

function Toast({ msg, kind }: { msg: string; kind: "ok" | "err" }) {
  return (
    <div
      className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border ${
        kind === "ok"
          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
          : "bg-red-500/10 border-red-500/40 text-red-300"
      }`}
    >
      {kind === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg}
    </div>
  );
}

type SubTab = "factory";

export function Admin() {
  const [tab] = useState<SubTab>("factory");

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Module 10</div>
        <h1 className="text-2xl md:text-3xl font-black text-white">Master Admin Control Center</h1>
        <p className="text-sm text-slate-400 mt-1">Direct-write publishing surface. Actions here bypass vendor queues.</p>
      </div>

      {/* Sub-nav */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-[#121214]/90 backdrop-blur border-b border-white/5 mb-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <button
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border whitespace-nowrap ${
              tab === "factory"
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                : "bg-[#1E1E24] border-white/10 text-slate-300"
            }`}
          >
            🚀 Global Content Factory
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MarketplaceForge />
        <AdInjector />
        <MegaBountyIssuer />
      </div>

      <div className="mt-6">
        <AdminHistory />
      </div>
    </div>
  );
}

// ----------------------------- 1. Marketplace Supply Forge -----------------------------

function MarketplaceForge() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AdminCategory>("themes");
  const [version, setVersion] = useState("");
  const [vendor, setVendor] = useState("Oventric Core Team");
  const [description, setDescription] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [priceNGN, setPriceNGN] = useState("");
  const [priceGHS, setPriceGHS] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reset = () => {
    setTitle(""); setVersion(""); setDescription("");
    setPriceUSD(""); setPriceNGN(""); setPriceGHS("");
  };

  const usdN = Number(priceUSD), ngnN = Number(priceNGN), ghsN = Number(priceGHS);

  const openPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !version.trim() || !description.trim() || !vendor.trim()) {
      setToast({ msg: "All fields are required.", kind: "err" }); return;
    }
    if (!(usdN > 0) || !(ngnN > 0) || !(ghsN > 0)) {
      setToast({ msg: "All three prices must be > 0.", kind: "err" }); return;
    }
    setToast(null);
    setPreviewOpen(true);
  };

  const confirmSubmit = () => {
    adminStore.addProduct({
      name: title.trim(), category, version: version.trim(), vendor: vendor.trim(),
      description: description.trim(), priceUSD: usdN, priceNGN: ngnN, priceGHS: ghsN,
    });
    setPreviewOpen(false);
    setToast({ msg: `Asset forged into ${category} grid.`, kind: "ok" });
    reset();
  };

  const fields: TokenField[] = [
    { label: "name", value: title.trim(), mono: true },
    { label: "category", value: category, mono: true, accent: "ok" },
    { label: "version", value: `v${version.trim()}`, mono: true },
    { label: "vendor", value: vendor.trim() },
    { label: "description", value: description.trim(), multiline: true },
    { label: "price.USD", value: `$${usdN.toFixed(2)}`, mono: true },
    { label: "price.NGN", value: `₦${ngnN.toFixed(2)}`, mono: true },
    { label: "price.GHS", value: `₵${ghsN.toFixed(2)}`, mono: true },
    { label: "stream", value: `marketplace / ${category}`, mono: true, accent: "muted" },
  ];

  return (
    <>
      <form onSubmit={openPreview} className="bg-[#1E1E24] border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Store className="w-4 h-4 text-emerald-300" />
          </span>
          <div>
            <h2 className="text-white font-black text-base leading-tight">Marketplace Supply Forge</h2>
            <p className="text-[11px] text-slate-500">Push house-branded assets into Module 4.</p>
          </div>
        </div>

        <div>
          <FieldLabel>Asset Title</FieldLabel>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nebula Admin Theme" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Category</FieldLabel>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as AdminCategory)}>
              <option value="themes">Themes</option>
              <option value="plugins">Plugins</option>
              <option value="blocks">HTML Blocks</option>
              <option value="scripts">Scripts</option>
            </select>
          </div>
          <div>
            <FieldLabel>Version Tag</FieldLabel>
            <input className={inputCls} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </div>
        </div>

        <div>
          <FieldLabel>System Author Override</FieldLabel>
          <input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea rows={3} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What ships in this asset..." />
        </div>

        <div>
          <FieldLabel>Pricing Matrix</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {(["USD", "NGN", "GHS"] as const).map((c) => {
              const val = c === "USD" ? priceUSD : c === "NGN" ? priceNGN : priceGHS;
              const set = c === "USD" ? setPriceUSD : c === "NGN" ? setPriceNGN : setPriceGHS;
              return (
                <div key={c} className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{CURRENCY_SYMBOL[c]}</span>
                  <input
                    type="number" min={0} step="0.01"
                    className={`${inputCls} pl-6`}
                    placeholder={c}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {toast && <Toast msg={toast.msg} kind={toast.kind} />}

        <button type="submit" className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors inline-flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" /> Preview & Forge
        </button>
      </form>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmSubmit}
        title={title.trim() || "Untitled asset"}
        subtitle={`Marketplace stream • ${category}`}
        accent="emerald"
        icon={<span className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0"><Store className="w-4 h-4 text-emerald-300" /></span>}
        confirmLabel="Confirm & Forge Asset"
        fields={fields}
        visual={
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">{category}</span>
              <span className="text-[10px] font-mono text-slate-500">v{version.trim() || "0.0.0"}</span>
            </div>
            <div className="text-white font-black text-lg leading-tight mb-1">{title.trim() || "Untitled asset"}</div>
            <p className="text-xs text-slate-400 line-clamp-3 mb-3">{description.trim() || "No description."}</p>
            <div className="flex items-baseline gap-3 text-xs">
              <span className="text-emerald-300 font-black text-base">${usdN.toFixed(2)}</span>
              <span className="text-slate-500 font-mono">₦{ngnN.toFixed(0)}</span>
              <span className="text-slate-500 font-mono">₵{ghsN.toFixed(0)}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">by {vendor.trim()}</div>
          </div>
        }
      />
    </>
  );
}

// ----------------------------- 2. Ad Server & Campaign Injector -----------------------------

function AdInjector() {
  const [advertiser, setAdvertiser] = useState("");
  const [placement, setPlacement] = useState<AdPlacement>("feed");
  const [tier, setTier] = useState<AdTier>("banner");
  const [mediaUrl, setMediaUrl] = useState("");
  const [cta, setCta] = useState("Claim Free Credit");
  const [clickUrl, setClickUrl] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reset = () => {
    setAdvertiser(""); setMediaUrl(""); setCta("Claim Free Credit"); setClickUrl("");
    setStartAt(""); setEndAt("");
  };

  const toEpoch = (s: string): number | null => {
    if (!s) return null;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : null;
  };

  const startEpoch = toEpoch(startAt);
  const endEpoch = toEpoch(endAt);

  const openPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advertiser.trim() || !cta.trim() || !clickUrl.trim()) {
      setToast({ msg: "Advertiser, CTA and URL are required.", kind: "err" }); return;
    }
    if (tier !== "text" && !mediaUrl.trim()) {
      setToast({ msg: "Media URL required for Tier 2/3.", kind: "err" }); return;
    }
    if (startEpoch != null && endEpoch != null && endEpoch <= startEpoch) {
      setToast({ msg: "End time must be after start time.", kind: "err" }); return;
    }
    setToast(null);
    setPreviewOpen(true);
  };

  const confirmSubmit = () => {
    adminStore.addAd({
      advertiser: advertiser.trim(), placement, tier,
      mediaUrl: mediaUrl.trim(), cta: cta.trim(), clickUrl: clickUrl.trim(),
      startAt: startEpoch, endAt: endEpoch,
    });
    setPreviewOpen(false);
    const scheduleNote =
      startEpoch && startEpoch > Date.now()
        ? " Scheduled to start soon."
        : endEpoch
          ? " Running until end date."
          : "";
    setToast({ msg: `Campaign live across placement.${scheduleNote}`, kind: "ok" });
    reset();
  };

  const fmtWindow = (ms: number | null): string =>
    ms == null ? "—" : new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const tierLabel = tier === "text" ? "Tier 1 — Text" : tier === "banner" ? "Tier 2 — Banner" : "Tier 3 — Video";

  const fields: TokenField[] = [
    { label: "advertiser", value: advertiser.trim(), mono: true },
    { label: "placement", value: placement, mono: true, accent: "ok" },
    { label: "tier", value: tierLabel, mono: true },
    { label: "media_url", value: mediaUrl.trim() || (tier === "text" ? "(none — text tier)" : "—"), mono: true, accent: mediaUrl.trim() ? "default" : "muted" },
    { label: "cta", value: cta.trim() },
    { label: "click_url", value: clickUrl.trim(), mono: true },
    { label: "starts_at", value: fmtWindow(startEpoch), mono: true, accent: startEpoch ? "warn" : "muted" },
    { label: "ends_at", value: fmtWindow(endEpoch), mono: true, accent: endEpoch ? "warn" : "muted" },
    { label: "stream", value: `ads / ${placement} loop`, mono: true, accent: "muted" },
  ];

  return (
    <>
      <form onSubmit={openPreview} className="bg-[#1E1E24] border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-fuchsia-300" />
          </span>
          <div>
            <h2 className="text-white font-black text-base leading-tight">Ad Server & Campaign Injector</h2>
            <p className="text-[11px] text-slate-500">Force placement across Modules 3, 4, 8.</p>
          </div>
        </div>

        <div>
          <FieldLabel>Campaign Advertiser</FieldLabel>
          <input className={inputCls} value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} placeholder="Kessler Labs" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Target Placement</FieldLabel>
            <select className={inputCls} value={placement} onChange={(e) => setPlacement(e.target.value as AdPlacement)}>
              <option value="feed">Social Feed Loop</option>
              <option value="marketplace">Marketplace Grid Slot</option>
              <option value="academy">Academy Stream Grid</option>
            </select>
          </div>
          <div>
            <FieldLabel>Advertisement Tier</FieldLabel>
            <select className={inputCls} value={tier} onChange={(e) => setTier(e.target.value as AdTier)}>
              <option value="text">Tier 1 — Text Only</option>
              <option value="banner">Tier 2 — Visual Banner</option>
              <option value="video">Tier 3 — Video Player</option>
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>Creative Media URL</FieldLabel>
          <input className={inputCls} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://cdn.example.com/creative.jpg" />
        </div>

        <div>
          <FieldLabel>Call-to-Action Text</FieldLabel>
          <input className={inputCls} value={cta} onChange={(e) => setCta(e.target.value)} />
        </div>

        <div>
          <FieldLabel>Destination Click-Through URL</FieldLabel>
          <input className={inputCls} value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="https://target.example.com/campaign" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start (optional)</FieldLabel>
            <input type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <p className="text-[10px] text-slate-500 mt-1">Leave empty to start immediately.</p>
          </div>
          <div>
            <FieldLabel>End (optional)</FieldLabel>
            <input type="datetime-local" className={inputCls} value={endAt} onChange={(e) => setEndAt(e.target.value)} min={startAt || undefined} />
            <p className="text-[10px] text-slate-500 mt-1">Leave empty to run indefinitely.</p>
          </div>
        </div>

        {toast && <Toast msg={toast.msg} kind={toast.kind} />}

        <button type="submit" className="w-full py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-black text-sm transition-colors inline-flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" /> Preview & Launch
        </button>
      </form>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmSubmit}
        title={advertiser.trim() || "Untitled campaign"}
        subtitle={`${tierLabel} • ${placement} loop`}
        accent="fuchsia"
        icon={<span className="w-9 h-9 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center shrink-0"><Megaphone className="w-4 h-4 text-fuchsia-300" /></span>}
        confirmLabel="Confirm & Launch Campaign"
        fields={fields}
        visual={
          <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Sponsored • {placement}</span>
              <span className="text-[10px] font-mono text-slate-500">{tierLabel}</span>
            </div>
            {tier !== "text" && mediaUrl.trim() && (
              <div className="aspect-[16/9] rounded-lg bg-[#121214] border border-white/10 mb-3 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl.trim()} alt="Creative preview" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div className="text-white font-black text-base mb-1">{advertiser.trim() || "Advertiser"}</div>
            <button type="button" className="w-full py-2 rounded-lg bg-fuchsia-500 text-black font-black text-xs">
              {cta.trim() || "Learn more"}
            </button>
            <div className="text-[10px] text-slate-500 mt-2 truncate">→ {clickUrl.trim() || "(no url)"}</div>
            {(startEpoch || endEpoch) && (
              <div className="text-[10px] text-amber-300 mt-2 font-mono">
                Window: {fmtWindow(startEpoch)} → {fmtWindow(endEpoch)}
              </div>
            )}
          </div>
        }
      />
    </>
  );
}

// ----------------------------- 3. Sovereign Mega-Bounty Issuer -----------------------------

function MegaBountyIssuer() {
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [timeframe, setTimeframe] = useState("48 Hours");
  const [applicantLimit, setApplicantLimit] = useState("10");
  const [escrow, setEscrow] = useState("");
  const [currency, setCurrency] = useState<AdminCurrency>("USD");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const reset = () => { setTitle(""); setScope(""); setEscrow(""); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(applicantLimit), esc = Number(escrow);
    if (!title.trim() || !scope.trim() || !timeframe.trim()) {
      setToast({ msg: "Title, scope and timeframe are required.", kind: "err" }); return;
    }
    if (!(limit > 0) || !(esc > 0)) {
      setToast({ msg: "Applicant limit and escrow must be > 0.", kind: "err" }); return;
    }
    adminStore.addBounty({
      title: title.trim(), scope: scope.trim(), timeframe: timeframe.trim(),
      applicantLimit: limit, escrowAmount: esc, escrowCurrency: currency,
    });
    setToast({ msg: "Bounty deployed and escrow locked.", kind: "ok" });
    reset();
  };

  return (
    <form onSubmit={submit} className="bg-[#1E1E24] border border-white/5 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Target className="w-4 h-4 text-amber-300" />
        </span>
        <div>
          <h2 className="text-white font-black text-base leading-tight">Sovereign Mega-Bounty Issuer</h2>
          <p className="text-[11px] text-slate-500">Corporate-backed drops into Module 5.</p>
        </div>
      </div>

      <div>
        <FieldLabel>Project Task Title</FieldLabel>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ship a hardened RLS matrix" />
      </div>

      <div>
        <FieldLabel>Scope of Technical Requirements</FieldLabel>
        <textarea rows={5} className={`${inputCls} font-mono text-xs`} value={scope} onChange={(e) => setScope(e.target.value)} placeholder={"## Deliverables\n- ...\n- ..."} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Est. Timeframe</FieldLabel>
          <input className={inputCls} value={timeframe} onChange={(e) => setTimeframe(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Applicants Limit</FieldLabel>
          <input type="number" min={1} className={inputCls} value={applicantLimit} onChange={(e) => setApplicantLimit(e.target.value)} />
        </div>
      </div>

      <div>
        <FieldLabel>Escrow Funding Commitment</FieldLabel>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{CURRENCY_SYMBOL[currency]}</span>
            <input type="number" min={0} step="0.01" className={`${inputCls} pl-6`} value={escrow} onChange={(e) => setEscrow(e.target.value)} placeholder="5000" />
          </div>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(["USD", "NGN", "GHS"] as const).map((c) => (
              <button
                type="button" key={c} onClick={() => setCurrency(c)}
                className={`px-3 text-xs font-bold ${currency === c ? "bg-amber-500 text-black" : "bg-[#121214] text-slate-300 hover:text-white"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}

      <button type="submit" className="rgb-pulse-glow w-full py-2.5 rounded-lg bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2">
        <Rocket className="w-4 h-4" /> Deploy Public Bounty & Lock Escrow
      </button>
    </form>
  );
}
