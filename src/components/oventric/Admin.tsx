import { useState } from "react";
import { Store, Megaphone, Target, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  adminStore,
  type AdminCategory,
  type AdPlacement,
  type AdTier,
  type AdminCurrency,
} from "@/lib/admin/store";
import { createProduct } from "@/lib/marketplace.functions";
import { AdminHistory } from "./AdminHistory";
import { PreviewModal, type TokenField } from "./AdminPreviewModal";
import { ResponsiveImage } from "@/components/ui/responsive-image";

const CURRENCY_SYMBOL: Record<AdminCurrency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-[#121214] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60";

/** Merge error-state ring into the base input class. */
function fieldCls(hasError: boolean): string {
  return hasError
    ? "w-full bg-[#121214] border border-red-500/60 rounded-[10px] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-400"
    : inputCls;
}

function InlineError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-400">
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  );
}

/** Simulate a server round-trip; the admin store is client-only, but this preserves the "reset only after success" contract. */
async function commitToServer<T>(fn: () => T): Promise<T> {
  await new Promise((r) => setTimeout(r, 350));
  return fn();
}

type SubTab = "factory";

export function Admin() {
  const [tab] = useState<SubTab>("factory");

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
          Module 10
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white">Master Admin Control Center</h1>
        <p className="text-sm text-slate-400 mt-1">
          Direct-write publishing surface. Actions here bypass vendor queues.
        </p>
      </div>

      {/* Sub-nav */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-[#121214] border-b border-white/5 mb-6">
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
  const persistProduct = useServerFn(createProduct);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AdminCategory>("themes");
  const [version, setVersion] = useState("");
  const [vendor, setVendor] = useState("Oventric Core Team");
  const [description, setDescription] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [priceNGN, setPriceNGN] = useState("");
  const [priceGHS, setPriceGHS] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  type Field =
    | "title"
    | "version"
    | "vendor"
    | "description"
    | "priceUSD"
    | "priceNGN"
    | "priceGHS";
  const clearErr = (k: Field) => setErrors((prev) => (prev[k] ? { ...prev, [k]: "" } : prev));

  const reset = () => {
    setTitle("");
    setVersion("");
    setDescription("");
    setPriceUSD("");
    setPriceNGN("");
    setPriceGHS("");
    setErrors({});
  };

  const usdN = Number(priceUSD),
    ngnN = Number(priceNGN),
    ghsN = Number(priceGHS);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Asset title is required.";
    else if (title.trim().length > 100) e.title = "Keep title under 100 characters.";
    if (!version.trim()) e.version = "Version tag required (e.g. 1.0.0).";
    if (!vendor.trim()) e.vendor = "Vendor name required.";
    if (!description.trim()) e.description = "Description required.";
    else if (description.trim().length > 500)
      e.description = "Description must be under 500 characters.";
    if (!(usdN > 0)) e.priceUSD = "USD price must be > 0.";
    if (!(ngnN > 0)) e.priceNGN = "NGN price must be > 0.";
    if (!(ghsN > 0)) e.priceGHS = "GHS price must be > 0.";
    return e;
  };

  const openPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Fix the highlighted fields", {
        description: `${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? "" : "s"} need attention before forging.`,
      });
      return;
    }
    setPreviewOpen(true);
  };

  const confirmSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await persistProduct({
        data: {
          name: title.trim(),
          category,
          description: description.trim(),
          priceUSD: usdN,
          vendor: vendor.trim(),
        },
      });
      adminStore.addProduct({
        name: title.trim(),
        category,
        version: version.trim(),
        vendor: vendor.trim(),
        description: description.trim(),
        priceUSD: usdN,
        priceNGN: ngnN,
        priceGHS: ghsN,
      });
      toast.success("Asset forged", {
        description: `${title.trim()} is now live in the ${category} grid.`,
      });
      setPreviewOpen(false);
      reset();
    } catch (err) {
      toast.error("Forge failed", {
        description:
          err instanceof Error ? err.message : "The server rejected the asset. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
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
      <form
        onSubmit={openPreview}
        noValidate
        className="bg-[#1E1E24] border border-white/5 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-[10px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Store className="w-4 h-4 text-emerald-300" />
          </span>
          <div>
            <h2 className="text-white font-black text-base leading-tight">
              Marketplace Supply Forge
            </h2>
            <p className="text-[11px] text-slate-500">Push house-branded assets into Module 4.</p>
          </div>
        </div>

        <div>
          <FieldLabel>Asset Title</FieldLabel>
          <input
            className={fieldCls(!!errors.title)}
            value={title}
            maxLength={100}
            onChange={(e) => {
              setTitle(e.target.value);
              clearErr("title");
            }}
            placeholder="Nebula Admin Theme"
            aria-invalid={!!errors.title}
          />
          <InlineError msg={errors.title} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Category</FieldLabel>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as AdminCategory)}
            >
              <option value="themes">Themes</option>
              <option value="plugins">Plugins</option>
              <option value="blocks">HTML Blocks</option>
              <option value="scripts">Scripts</option>
            </select>
          </div>
          <div>
            <FieldLabel>Version Tag</FieldLabel>
            <input
              className={fieldCls(!!errors.version)}
              value={version}
              onChange={(e) => {
                setVersion(e.target.value);
                clearErr("version");
              }}
              placeholder="1.0.0"
              aria-invalid={!!errors.version}
            />
            <InlineError msg={errors.version} />
          </div>
        </div>

        <div>
          <FieldLabel>System Author Override</FieldLabel>
          <input
            className={fieldCls(!!errors.vendor)}
            value={vendor}
            onChange={(e) => {
              setVendor(e.target.value);
              clearErr("vendor");
            }}
            aria-invalid={!!errors.vendor}
          />
          <InlineError msg={errors.vendor} />
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            rows={3}
            className={fieldCls(!!errors.description)}
            value={description}
            maxLength={500}
            onChange={(e) => {
              setDescription(e.target.value);
              clearErr("description");
            }}
            placeholder="What ships in this asset..."
            aria-invalid={!!errors.description}
          />
          <InlineError msg={errors.description} />
        </div>

        <div>
          <FieldLabel>Pricing Matrix</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {(["USD", "NGN", "GHS"] as const).map((c) => {
              const val = c === "USD" ? priceUSD : c === "NGN" ? priceNGN : priceGHS;
              const set = c === "USD" ? setPriceUSD : c === "NGN" ? setPriceNGN : setPriceGHS;
              const key: Field = c === "USD" ? "priceUSD" : c === "NGN" ? "priceNGN" : "priceGHS";
              const err = errors[key];
              return (
                <div key={c}>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                      {CURRENCY_SYMBOL[c]}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${fieldCls(!!err)} pl-6`}
                      placeholder={c}
                      value={val}
                      onChange={(e) => {
                        set(e.target.value);
                        clearErr(key);
                      }}
                      aria-invalid={!!err}
                    />
                  </div>
                  <InlineError msg={err} />
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors inline-flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" /> Preview & Forge
        </button>
      </form>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmSubmit}
        isSubmitting={submitting}
        title={title.trim() || "Untitled asset"}
        subtitle={`Marketplace stream • ${category}`}
        accent="emerald"
        icon={
          <span className="w-9 h-9 rounded-[10px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Store className="w-4 h-4 text-emerald-300" />
          </span>
        }
        confirmLabel="Confirm & Forge Asset"
        fields={fields}
        visual={
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                {category}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                v{version.trim() || "0.0.0"}
              </span>
            </div>
            <div className="text-white font-black text-lg leading-tight mb-1">
              {title.trim() || "Untitled asset"}
            </div>
            <p className="text-xs text-slate-400 line-clamp-3 mb-3">
              {description.trim() || "No description."}
            </p>
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clearErr = (k: string) => setErrors((prev) => (prev[k] ? { ...prev, [k]: "" } : prev));

  const reset = () => {
    setAdvertiser("");
    setMediaUrl("");
    setCta("Claim Free Credit");
    setClickUrl("");
    setStartAt("");
    setEndAt("");
    setErrors({});
  };

  const toEpoch = (s: string): number | null => {
    if (!s) return null;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : null;
  };

  const startEpoch = toEpoch(startAt);
  const endEpoch = toEpoch(endAt);

  const isValidUrl = (s: string): boolean => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!advertiser.trim()) e.advertiser = "Advertiser name required.";
    if (!cta.trim()) e.cta = "CTA text required.";
    else if (cta.trim().length > 40) e.cta = "Keep CTA under 40 characters.";
    if (!clickUrl.trim()) e.clickUrl = "Destination URL required.";
    else if (!isValidUrl(clickUrl.trim())) e.clickUrl = "Must be a valid http(s) URL.";
    if (tier !== "text") {
      if (!mediaUrl.trim()) e.mediaUrl = "Media URL required for Tier 2/3.";
      else if (!isValidUrl(mediaUrl.trim())) e.mediaUrl = "Must be a valid http(s) URL.";
    }
    if (startEpoch != null && endEpoch != null && endEpoch <= startEpoch) {
      e.endAt = "End must be after start.";
    }
    return e;
  };

  const openPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Fix the highlighted fields", {
        description: `${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? "" : "s"} need attention before launch.`,
      });
      return;
    }
    setPreviewOpen(true);
  };

  const confirmSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await commitToServer(() =>
        adminStore.addAd({
          advertiser: advertiser.trim(),
          placement,
          tier,
          mediaUrl: mediaUrl.trim(),
          cta: cta.trim(),
          clickUrl: clickUrl.trim(),
          startAt: startEpoch,
          endAt: endEpoch,
        }),
      );
      const scheduleNote =
        startEpoch && startEpoch > Date.now()
          ? " Scheduled to start soon."
          : endEpoch
            ? " Running until end date."
            : "";
      toast.success("Campaign launched", {
        description: `${advertiser.trim()} is live in the ${placement} loop.${scheduleNote}`,
      });
      setPreviewOpen(false);
      reset();
    } catch (err) {
      toast.error("Launch failed", {
        description:
          err instanceof Error ? err.message : "The ad server rejected the campaign. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtWindow = (ms: number | null): string =>
    ms == null
      ? "—"
      : new Date(ms).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

  const tierLabel =
    tier === "text" ? "Tier 1 — Text" : tier === "banner" ? "Tier 2 — Banner" : "Tier 3 — Video";

  const fields: TokenField[] = [
    { label: "advertiser", value: advertiser.trim(), mono: true },
    { label: "placement", value: placement, mono: true, accent: "ok" },
    { label: "tier", value: tierLabel, mono: true },
    {
      label: "media_url",
      value: mediaUrl.trim() || (tier === "text" ? "(none — text tier)" : "—"),
      mono: true,
      accent: mediaUrl.trim() ? "default" : "muted",
    },
    { label: "cta", value: cta.trim() },
    { label: "click_url", value: clickUrl.trim(), mono: true },
    {
      label: "starts_at",
      value: fmtWindow(startEpoch),
      mono: true,
      accent: startEpoch ? "warn" : "muted",
    },
    {
      label: "ends_at",
      value: fmtWindow(endEpoch),
      mono: true,
      accent: endEpoch ? "warn" : "muted",
    },
    { label: "stream", value: `ads / ${placement} loop`, mono: true, accent: "muted" },
  ];

  return (
    <>
      <form
        onSubmit={openPreview}
        noValidate
        className="bg-[#1E1E24] border border-white/5 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-[10px] bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-fuchsia-300" />
          </span>
          <div>
            <h2 className="text-white font-black text-base leading-tight">
              Ad Server & Campaign Injector
            </h2>
            <p className="text-[11px] text-slate-500">Force placement across Modules 3, 4, 8.</p>
          </div>
        </div>

        <div>
          <FieldLabel>Campaign Advertiser</FieldLabel>
          <input
            className={fieldCls(!!errors.advertiser)}
            value={advertiser}
            onChange={(e) => {
              setAdvertiser(e.target.value);
              clearErr("advertiser");
            }}
            placeholder="Kessler Labs"
            aria-invalid={!!errors.advertiser}
          />
          <InlineError msg={errors.advertiser} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Target Placement</FieldLabel>
            <select
              className={inputCls}
              value={placement}
              onChange={(e) => setPlacement(e.target.value as AdPlacement)}
            >
              <option value="feed">Social Feed Loop</option>
              <option value="marketplace">Marketplace Grid Slot</option>
              <option value="academy">Academy Stream Grid</option>
            </select>
          </div>
          <div>
            <FieldLabel>Advertisement Tier</FieldLabel>
            <select
              className={inputCls}
              value={tier}
              onChange={(e) => {
                setTier(e.target.value as AdTier);
                clearErr("mediaUrl");
              }}
            >
              <option value="text">Tier 1 — Text Only</option>
              <option value="banner">Tier 2 — Visual Banner</option>
              <option value="video">Tier 3 — Video Player</option>
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>Creative Media URL</FieldLabel>
          <input
            className={fieldCls(!!errors.mediaUrl)}
            value={mediaUrl}
            onChange={(e) => {
              setMediaUrl(e.target.value);
              clearErr("mediaUrl");
            }}
            placeholder="https://cdn.example.com/creative.jpg"
            aria-invalid={!!errors.mediaUrl}
          />
          <InlineError msg={errors.mediaUrl} />
        </div>

        <div>
          <FieldLabel>Call-to-Action Text</FieldLabel>
          <input
            className={fieldCls(!!errors.cta)}
            value={cta}
            maxLength={40}
            onChange={(e) => {
              setCta(e.target.value);
              clearErr("cta");
            }}
            aria-invalid={!!errors.cta}
          />
          <InlineError msg={errors.cta} />
        </div>

        <div>
          <FieldLabel>Destination Click-Through URL</FieldLabel>
          <input
            className={fieldCls(!!errors.clickUrl)}
            value={clickUrl}
            onChange={(e) => {
              setClickUrl(e.target.value);
              clearErr("clickUrl");
            }}
            placeholder="https://target.example.com/campaign"
            aria-invalid={!!errors.clickUrl}
          />
          <InlineError msg={errors.clickUrl} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start (optional)</FieldLabel>
            <input
              type="datetime-local"
              className={inputCls}
              value={startAt}
              onChange={(e) => {
                setStartAt(e.target.value);
                clearErr("endAt");
              }}
            />
            <p className="text-[10px] text-slate-500 mt-1">Leave empty to start immediately.</p>
          </div>
          <div>
            <FieldLabel>End (optional)</FieldLabel>
            <input
              type="datetime-local"
              className={fieldCls(!!errors.endAt)}
              value={endAt}
              onChange={(e) => {
                setEndAt(e.target.value);
                clearErr("endAt");
              }}
              min={startAt || undefined}
              aria-invalid={!!errors.endAt}
            />
            <InlineError msg={errors.endAt} />
            {!errors.endAt && (
              <p className="text-[10px] text-slate-500 mt-1">Leave empty to run indefinitely.</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-[10px] bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-black text-sm transition-colors inline-flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" /> Preview & Launch
        </button>
      </form>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmSubmit}
        isSubmitting={submitting}
        title={advertiser.trim() || "Untitled campaign"}
        subtitle={`${tierLabel} • ${placement} loop`}
        accent="fuchsia"
        icon={
          <span className="w-9 h-9 rounded-[10px] bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4 text-fuchsia-300" />
          </span>
        }
        confirmLabel="Confirm & Launch Campaign"
        fields={fields}
        visual={
          <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">
                Sponsored • {placement}
              </span>
              <span className="text-[10px] font-mono text-slate-500">{tierLabel}</span>
            </div>
            {tier !== "text" && mediaUrl.trim() && (
              <div className="aspect-[16/9] rounded-[10px] bg-[#121214] border border-white/10 mb-3 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <ResponsiveImage
                  sizes="(min-width: 640px) 480px, 100vw"
                  src={mediaUrl.trim()}
                  alt="Creative preview"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="text-white font-black text-base mb-1">
              {advertiser.trim() || "Advertiser"}
            </div>
            <button
              type="button"
              className="w-full py-2 rounded-[10px] bg-fuchsia-500 text-black font-black text-xs"
            >
              {cta.trim() || "Learn more"}
            </button>
            <div className="text-[10px] text-slate-500 mt-2 truncate">
              → {clickUrl.trim() || "(no url)"}
            </div>
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clearErr = (k: string) => setErrors((prev) => (prev[k] ? { ...prev, [k]: "" } : prev));

  const reset = () => {
    setTitle("");
    setScope("");
    setEscrow("");
    setErrors({});
  };

  const limitN = Number(applicantLimit);
  const escN = Number(escrow);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Task title is required.";
    else if (title.trim().length > 120) e.title = "Keep title under 120 characters.";
    if (!scope.trim()) e.scope = "Scope is required.";
    else if (scope.trim().length > 5000) e.scope = "Scope must be under 5000 characters.";
    if (!timeframe.trim()) e.timeframe = "Timeframe required.";
    if (!(limitN > 0)) e.applicantLimit = "Must accept at least 1 applicant.";
    if (!(escN > 0)) e.escrow = "Escrow must be > 0.";
    return e;
  };

  const openPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Fix the highlighted fields", {
        description: `${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? "" : "s"} need attention before deploy.`,
      });
      return;
    }
    setPreviewOpen(true);
  };

  const confirmSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await commitToServer(() =>
        adminStore.addBounty({
          title: title.trim(),
          scope: scope.trim(),
          timeframe: timeframe.trim(),
          applicantLimit: limitN,
          escrowAmount: escN,
          escrowCurrency: currency,
        }),
      );
      toast.success("Bounty deployed", {
        description: `${CURRENCY_SYMBOL[currency]}${escN.toLocaleString()} ${currency} escrow locked for "${title.trim()}".`,
      });
      setPreviewOpen(false);
      reset();
    } catch (err) {
      toast.error("Deploy failed", {
        description:
          err instanceof Error ? err.message : "The bounty board rejected the drop. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fields: TokenField[] = [
    { label: "title", value: title.trim(), mono: true },
    { label: "timeframe", value: timeframe.trim(), mono: true },
    { label: "applicant_limit", value: limitN, mono: true },
    {
      label: "escrow",
      value: `${CURRENCY_SYMBOL[currency]}${escN.toLocaleString()} ${currency}`,
      mono: true,
      accent: "warn",
    },
    { label: "scope", value: scope.trim(), mono: true, multiline: true },
    { label: "stream", value: "bounties / public board", mono: true, accent: "muted" },
  ];

  return (
    <>
      <form
        onSubmit={openPreview}
        noValidate
        className="bg-[#1E1E24] border border-white/5 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-[10px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-amber-300" />
          </span>
          <div>
            <h2 className="text-white font-black text-base leading-tight">
              Sovereign Mega-Bounty Issuer
            </h2>
            <p className="text-[11px] text-slate-500">Corporate-backed drops into Module 5.</p>
          </div>
        </div>

        <div>
          <FieldLabel>Project Task Title</FieldLabel>
          <input
            className={fieldCls(!!errors.title)}
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              clearErr("title");
            }}
            placeholder="Ship a hardened RLS matrix"
            aria-invalid={!!errors.title}
          />
          <InlineError msg={errors.title} />
        </div>

        <div>
          <FieldLabel>Scope of Technical Requirements</FieldLabel>
          <textarea
            rows={5}
            className={`${fieldCls(!!errors.scope)} font-mono text-xs`}
            value={scope}
            maxLength={5000}
            onChange={(e) => {
              setScope(e.target.value);
              clearErr("scope");
            }}
            placeholder={"## Deliverables\n- ...\n- ..."}
            aria-invalid={!!errors.scope}
          />
          <InlineError msg={errors.scope} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Est. Timeframe</FieldLabel>
            <input
              className={fieldCls(!!errors.timeframe)}
              value={timeframe}
              onChange={(e) => {
                setTimeframe(e.target.value);
                clearErr("timeframe");
              }}
              aria-invalid={!!errors.timeframe}
            />
            <InlineError msg={errors.timeframe} />
          </div>
          <div>
            <FieldLabel>Applicants Limit</FieldLabel>
            <input
              type="number"
              min={1}
              className={fieldCls(!!errors.applicantLimit)}
              value={applicantLimit}
              onChange={(e) => {
                setApplicantLimit(e.target.value);
                clearErr("applicantLimit");
              }}
              aria-invalid={!!errors.applicantLimit}
            />
            <InlineError msg={errors.applicantLimit} />
          </div>
        </div>

        <div>
          <FieldLabel>Escrow Funding Commitment</FieldLabel>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                {CURRENCY_SYMBOL[currency]}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={`${fieldCls(!!errors.escrow)} pl-6`}
                value={escrow}
                onChange={(e) => {
                  setEscrow(e.target.value);
                  clearErr("escrow");
                }}
                placeholder="5000"
                aria-invalid={!!errors.escrow}
              />
            </div>
            <div className="flex rounded-[10px] border border-white/10 overflow-hidden">
              {(["USD", "NGN", "GHS"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 text-xs font-bold ${currency === c ? "bg-amber-500 text-black" : "bg-[#121214] text-slate-300 hover:text-white"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <InlineError msg={errors.escrow} />
        </div>

        <button
          type="submit"
          className=" w-full py-2.5 rounded-[10px] bg-[#121214] text-white font-black text-sm inline-flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" /> Preview & Deploy Bounty
        </button>
      </form>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={confirmSubmit}
        isSubmitting={submitting}
        title={title.trim() || "Untitled bounty"}
        subtitle={`Escrow ${CURRENCY_SYMBOL[currency]}${escN.toLocaleString()} • ${timeframe.trim()}`}
        accent="amber"
        icon={
          <span className="w-9 h-9 rounded-[10px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-amber-300" />
          </span>
        }
        confirmLabel="Confirm & Lock Escrow"
        fields={fields}
        visual={
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                Public Bounty
              </span>
              <span className="text-[10px] font-mono text-slate-500">up to {limitN} solvers</span>
            </div>
            <div className="text-white font-black text-lg leading-tight mb-2">
              {title.trim() || "Untitled bounty"}
            </div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-amber-300 font-black text-xl">
                {CURRENCY_SYMBOL[currency]}
                {escN.toLocaleString()}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {currency} • {timeframe.trim()}
              </span>
            </div>
            <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto bg-[#121214] rounded-[10px] p-2 border border-white/5">
              {scope.trim() || "(no scope)"}
            </pre>
          </div>
        }
      />
    </>
  );
}
