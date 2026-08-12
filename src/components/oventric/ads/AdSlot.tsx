import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, PlayCircle, X, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getServingAds, type ServingAd, type AdPlacement } from "@/lib/ads.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { ResponsiveImage } from "@/components/ui/responsive-image";

/* ---------- session id (anon-safe) ---------- */
function adSessionId(): string {
  if (typeof window === "undefined") return "srv";
  try {
    const KEY = "ov_ad_session";
    let s = sessionStorage.getItem(KEY);
    if (!s) {
      s = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(KEY, s);
    }
    return s;
  } catch {
    return `${Date.now()}`;
  }
}

async function logEvent(
  campaignId: string,
  kind: "impression" | "click" | "lead",
  placement: AdPlacement,
  country: string | null,
  city: string | null,
) {
  try {
    await supabase.rpc("log_ad_event", {
      _campaign_id: campaignId,
      _kind: kind,
      _placement: placement,
      _country: country ?? "",
      _city: city ?? "",
      _session: adSessionId(),
    });
  } catch {
    /* best-effort */
  }
}

function useAdContext() {
  const { country } = useOnboarding();
  const countryCode = country === "NG" || country === "GH" ? country : null;
  return { country: countryCode, city: null as string | null };
}

/* ---------- data hook ---------- */
export function useServingAds(placement: AdPlacement, limit = 5) {
  const { country, city } = useAdContext();
  const fetchAds = useServerFn(getServingAds);
  return useQuery({
    queryKey: ["ads", placement, country, city, limit],
    queryFn: () => fetchAds({ data: { placement, country, city, limit } }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/* ---------- impression tracker ---------- */
function useImpression(
  ref: React.RefObject<HTMLElement | null>,
  campaignId: string | undefined,
  placement: AdPlacement,
) {
  const { country, city } = useAdContext();
  const fired = useRef(false);
  useEffect(() => {
    if (!campaignId || !ref.current || fired.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5 && !fired.current) {
            fired.current = true;
            void logEvent(campaignId, "impression", placement, country, city);
            io.disconnect();
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [campaignId, placement, country, city, ref]);
}

/* ---------- Lead form modal ---------- */
function LeadFormModal({
  ad,
  onClose,
  onSubmitted,
}: {
  ad: ServingAd;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("submit_ad_lead", {
        _campaign_id: ad.id,
        _name: name.trim(),
        _email: email.trim(),
        _phone: phone.trim(),
        _message: message.trim(),
        _meta: {},
      });
      if (error) throw new Error(error.message);
      toast.success("Thanks! We’ll be in touch.");
      onSubmitted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-light fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300 md:text-fuchsia-600 flex items-center gap-1">
              <Megaphone className="w-3 h-3" /> Sponsored
            </div>
            <h3 className="mt-1 text-lg font-bold text-white md:text-slate-900">
              {ad.header || "Get in touch"}
            </h3>
            {ad.description && (
              <p className="text-xs text-slate-400 md:text-slate-600 mt-0.5">{ad.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 md:text-slate-500 hover:text-white md:hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full bg-black/40 md:bg-slate-50 border border-white/10 md:border-slate-300 rounded-[10px] px-3 py-2 text-sm text-white md:text-slate-900 placeholder:text-slate-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-black/40 md:bg-slate-50 border border-white/10 md:border-slate-300 rounded-[10px] px-3 py-2 text-sm text-white md:text-slate-900 placeholder:text-slate-500"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full bg-black/40 md:bg-slate-50 border border-white/10 md:border-slate-300 rounded-[10px] px-3 py-2 text-sm text-white md:text-slate-900 placeholder:text-slate-500"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Message (optional)"
            className="w-full bg-black/40 md:bg-slate-50 border border-white/10 md:border-slate-300 rounded-[10px] px-3 py-2 text-sm text-white md:text-slate-900 placeholder:text-slate-500 resize-none"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-[10px] bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-60 text-black font-bold text-sm"
        >
          <Send className="w-4 h-4" /> {busy ? "Sending…" : ad.cta_label || "Submit"}
        </button>
      </div>
    </div>
  );
}

/* ---------- CTA resolver ---------- */
function useCtaHandler(ad: ServingAd, placement: AdPlacement) {
  const { country, city } = useAdContext();
  const [leadOpen, setLeadOpen] = useState(false);
  const onClick = useCallback(
    (e?: React.MouseEvent) => {
      void logEvent(ad.id, "click", placement, country, city);
      if (ad.cta_type === "lead_form") {
        e?.preventDefault();
        setLeadOpen(true);
        return;
      }
      const href =
        ad.cta_type === "whatsapp" && ad.cta_whatsapp
          ? `https://wa.me/${ad.cta_whatsapp.replace(/[^\d]/g, "")}`
          : ad.cta_url || "#";
      if (typeof window !== "undefined") window.open(href, "_blank", "noopener,noreferrer");
    },
    [ad, placement, country, city],
  );
  return { onClick, leadOpen, setLeadOpen };
}

/* ---------- Carousel media (image tier can have multiple) ---------- */
function CreativeMedia({ ad, aspect = "video" }: { ad: ServingAd; aspect?: "square" | "video" }) {
  const [idx, setIdx] = useState(0);
  const creatives = useMemo(() => ad.creatives.filter((c) => !!c.url).slice(0, 8), [ad.creatives]);
  if (creatives.length === 0) return null;
  const active = creatives[idx % creatives.length];
  const wrapCls = aspect === "square" ? "aspect-square" : "aspect-video";
  return (
    <div className={`relative w-full ${wrapCls} bg-black/40 overflow-hidden`}>
      {active.kind === "video" ? (
        <video
          key={active.id}
          src={active.url ?? undefined}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
        />
      ) : (
        <ResponsiveImage
          src={active.url ?? undefined}
          alt="Sponsored"
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      {ad.tier === "video" && active.kind !== "video" && (
        <PlayCircle className="absolute inset-0 m-auto w-12 h-12 text-white/90 md:text-slate-700" />
      )}
      {creatives.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIdx((n) => (n - 1 + creatives.length) % creatives.length);
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIdx((n) => (n + 1) % creatives.length);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {creatives.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Renderers ---------- */
function SponsoredBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-black/70 text-fuchsia-300 border border-fuchsia-400/50 rounded px-1.5 py-0.5">
      <Megaphone className="w-3 h-3" /> Sponsored
    </span>
  );
}

function BannerAd({ ad, placement }: { ad: ServingAd; placement: AdPlacement }) {
  const ref = useRef<HTMLDivElement>(null);
  useImpression(ref, ad.id, placement);
  const { onClick, leadOpen, setLeadOpen } = useCtaHandler(ad, placement);
  const hasMedia = ad.tier !== "text" && ad.creatives.some((c) => c.url);
  return (
    <>
      <div
        ref={ref}
        className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-fuchsia-500/30 rounded-xl overflow-hidden"
      >
        {hasMedia && <CreativeMedia ad={ad} aspect="video" />}
        <div className="p-4 flex flex-col gap-2">
          <SponsoredBadge />
          <div className="text-white md:text-slate-900 font-bold text-sm leading-snug">
            {ad.header || "Sponsored placement"}
          </div>
          {ad.description && (
            <div className="text-xs text-slate-400 md:text-slate-600 line-clamp-2">
              {ad.description}
            </div>
          )}
          {ad.body && (
            <div className="text-xs text-slate-500 md:text-slate-500 line-clamp-3">{ad.body}</div>
          )}
          <button
            type="button"
            onClick={onClick}
            className="self-start mt-1 inline-flex items-center justify-center px-3 py-1.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-semibold text-xs rounded-[10px]"
          >
            {ad.cta_label || "Learn more"}
          </button>
        </div>
      </div>
      {leadOpen && (
        <LeadFormModal
          ad={ad}
          onClose={() => setLeadOpen(false)}
          onSubmitted={() => void logEvent(ad.id, "lead", placement, null, null)}
        />
      )}
    </>
  );
}

function GridCardAd({ ad, placement }: { ad: ServingAd; placement: AdPlacement }) {
  const ref = useRef<HTMLDivElement>(null);
  useImpression(ref, ad.id, placement);
  const { onClick, leadOpen, setLeadOpen } = useCtaHandler(ad, placement);
  const hasMedia = ad.tier !== "text" && ad.creatives.some((c) => c.url);
  return (
    <>
      <div
        ref={ref}
        className="w-[220px] sm:w-[260px] snap-start row-span-2 flex flex-col bg-[#1E1E24] md:bg-white md:shadow-sm border border-fuchsia-500/30 rounded-xl overflow-hidden"
      >
        {hasMedia && <CreativeMedia ad={ad} aspect="square" />}
        <div className="p-3 flex flex-col gap-2 flex-1">
          <SponsoredBadge />
          <div className="text-white md:text-slate-900 font-bold text-sm leading-snug line-clamp-2">
            {ad.header || "Sponsored"}
          </div>
          {ad.description && (
            <div className="text-[11px] text-slate-500 md:text-slate-500 line-clamp-2 flex-1">
              {ad.description}
            </div>
          )}
          <button
            type="button"
            onClick={onClick}
            className="mt-auto inline-flex items-center justify-center px-3 py-1.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-semibold text-xs rounded-[10px]"
          >
            {ad.cta_label || "Learn more"}
          </button>
        </div>
      </div>
      {leadOpen && (
        <LeadFormModal
          ad={ad}
          onClose={() => setLeadOpen(false)}
          onSubmitted={() => void logEvent(ad.id, "lead", placement, null, null)}
        />
      )}
    </>
  );
}

function RailAd({ ad, placement }: { ad: ServingAd; placement: AdPlacement }) {
  const ref = useRef<HTMLDivElement>(null);
  useImpression(ref, ad.id, placement);
  const { onClick, leadOpen, setLeadOpen } = useCtaHandler(ad, placement);
  const hasMedia = ad.tier !== "text" && ad.creatives.some((c) => c.url);
  return (
    <>
      <div
        ref={ref}
        className="relative bg-[#1E1E24] md:bg-white md:shadow-sm border border-fuchsia-500/30 rounded-2xl overflow-hidden"
      >
        {hasMedia && <CreativeMedia ad={ad} aspect="video" />}
        <div className="p-4 text-center">
          <SponsoredBadge />
          <div className="mt-2 text-sm font-bold text-white md:text-slate-900 leading-snug line-clamp-2">
            {ad.header || "Sponsored placement"}
          </div>
          {ad.description && (
            <p className="mt-1 text-[11px] text-slate-400 md:text-slate-600 leading-relaxed line-clamp-2">
              {ad.description}
            </p>
          )}
          <button
            type="button"
            onClick={onClick}
            className="mt-3 inline-flex items-center justify-center px-4 py-1.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold text-xs rounded-[10px]"
          >
            {ad.cta_label || "Learn more"}
          </button>
        </div>
      </div>
      {leadOpen && (
        <LeadFormModal
          ad={ad}
          onClose={() => setLeadOpen(false)}
          onSubmitted={() => void logEvent(ad.id, "lead", placement, null, null)}
        />
      )}
    </>
  );
}

/* ---------- Public component ---------- */
export function AdSlot({
  placement,
  variant = "banner",
  index = 0,
}: {
  placement: AdPlacement;
  variant?: "banner" | "grid" | "rail";
  /** When multiple slots share a placement, pick a different ad by rotating. */
  index?: number;
}) {
  const { data } = useServingAds(placement);
  const ads = data ?? [];
  if (ads.length === 0) return null;
  const ad = ads[index % ads.length];
  if (variant === "grid") return <GridCardAd ad={ad} placement={placement} />;
  if (variant === "rail") return <RailAd ad={ad} placement={placement} />;
  return <BannerAd ad={ad} placement={placement} />;
}
