import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { AdvertInquiryModal } from "@/components/oventric/AdvertInquiryModal";
import {
  Megaphone, Image as ImageIcon, Video, Sparkles, MapPin,
  Users, BarChart3, Target as TargetIcon, ShieldCheck, Rocket, ChevronRight, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise on Oventric — Reach builders across Africa" },
      { name: "description", content: "Text, image, and video ad tiers on Oventric. Target cities in Nigeria, Ghana, and beyond. Transparent pricing, wallet-funded budgets, admin-managed campaigns." },
      { property: "og:title", content: "Advertise on Oventric" },
      { property: "og:description", content: "Reach thousands of builders, sellers, and learners across Africa with text, image, or video ads." },
    ],
  }),
  component: AdvertisePage,
});

const TIERS = [
  {
    id: "text",
    icon: Megaphone,
    name: "Text",
    tagline: "Lightest & cheapest",
    price: "$3",
    per: "/day min",
    color: "from-slate-500/20 to-slate-500/5",
    ring: "border-slate-500/40",
    features: [
      "Header + short description + body",
      "CTA: WhatsApp, Lead form, or Website link",
      "Great for lead-gen & fast tests",
    ],
  },
  {
    id: "image",
    icon: ImageIcon,
    name: "Image",
    tagline: "Most popular",
    price: "$8",
    per: "/day min",
    color: "from-emerald-500/25 to-emerald-500/5",
    ring: "border-emerald-500/60",
    features: [
      "1:1 image (fits Feed, Marketplace & Academy)",
      "Up to 5 images as a carousel",
      "Header, description & CTA included",
    ],
    highlight: true,
  },
  {
    id: "video",
    icon: Video,
    name: "Video",
    tagline: "Highest impact",
    price: "$20",
    per: "/day min",
    color: "from-purple-500/25 to-purple-500/5",
    ring: "border-purple-500/40",
    features: [
      "Up to 5 min video, 100 MB max",
      "Header + description + body + CTA",
      "Autoplay in Feed & Discovery rail",
    ],
  },
];

const COVERAGE = [
  { country: "🇳🇬 Nigeria", cities: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Benin City", "Enugu", "Uyo"] },
  { country: "🇬🇭 Ghana", cities: ["Accra", "Kumasi", "Takoradi", "Tamale", "Cape Coast"] },
  { country: "🌍 Rest of the world", cities: ["USD-priced campaigns available on request"] },
];

const STEPS = [
  { icon: Rocket, title: "Pick a tier", body: "Text, image, or video — you choose the level of impact." },
  { icon: ImageIcon, title: "Send your creative", body: "Upload copy, images, and video specs through our secure form." },
  { icon: TargetIcon, title: "Target audience", body: "Choose countries, cities, duration and daily budget." },
  { icon: ShieldCheck, title: "Admin reviews", body: "Our team contacts you to finalise creative, pricing and go-live date." },
  { icon: BarChart3, title: "Fund & launch", body: "Fund your wallet with the exact campaign total. Ad goes live on approval." },
];

function AdvertisePage() {
  const [open, setOpen] = useState(false);
  const [presetTier, setPresetTier] = useState<"text" | "image" | "video">("image");

  const start = (tier: "text" | "image" | "video" = "image") => {
    setPresetTier(tier);
    setOpen(true);
  };

  return (
    <PublicChrome>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-14">

        {/* Hero */}
        <section className="text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Advertise on Oventric
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-black text-white leading-tight">
            Put your brand in front of<br className="hidden md:block" /> builders across Africa
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-slate-400">
            Three simple ad tiers, transparent pricing, city-level targeting in Nigeria & Ghana,
            wallet-funded budgets — no auctions, no surprises.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => start("image")}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-full inline-flex items-center gap-2"
            >
              Explore & Get Started <ChevronRight className="w-4 h-4" />
            </button>
            <a
              href="#tiers"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold rounded-full"
            >
              See ad tiers
            </a>
          </div>
        </section>

        {/* Quick stats */}
        <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, k: "10k+", v: "Active builders" },
            { icon: MapPin, k: "20+", v: "Cities targeted" },
            { icon: BarChart3, k: "3", v: "Placements: Feed, Market, Academy" },
            { icon: ShieldCheck, k: "24h", v: "Avg admin review" },
          ].map((s) => (
            <div key={s.v} className="p-4 rounded-2xl bg-[#141418] border border-white/10 text-center">
              <s.icon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <div className="text-lg font-black text-white">{s.k}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">{s.v}</div>
            </div>
          ))}
        </section>

        {/* Tiers */}
        <section id="tiers" className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white">Three tiers. One goal.</h2>
            <p className="text-sm text-slate-400 mt-2">Choose the format that fits your budget and message.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`relative p-6 rounded-2xl bg-gradient-to-b ${t.color} border ${t.ring} flex flex-col`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider">
                    Popular
                  </span>
                )}
                <t.icon className="w-8 h-8 text-white" />
                <div className="mt-4 text-xs uppercase tracking-wider text-slate-400 font-bold">{t.tagline}</div>
                <div className="text-2xl font-black text-white mt-1">{t.name} ads</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">{t.price}</span>
                  <span className="text-xs text-slate-400">{t.per}</span>
                </div>
                <ul className="mt-4 space-y-2 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => start(t.id as "text" | "image" | "video")}
                  className="mt-5 w-full h-11 rounded-full bg-white/5 hover:bg-emerald-500 hover:text-black border border-white/10 text-white text-xs font-black transition-colors"
                >
                  Start with {t.name}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 text-center mt-4">
            Prices are indicative daily minimums. Total = daily budget × duration. Admin confirms final quote before you fund.
          </p>
        </section>

        {/* Coverage */}
        <section className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white">Where your ads run</h2>
            <p className="text-sm text-slate-400 mt-2">Target entire countries or drill down to specific cities.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {COVERAGE.map((c) => (
              <div key={c.country} className="p-5 rounded-2xl bg-[#141418] border border-white/10">
                <div className="text-lg font-black text-white">{c.country}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.cities.map((city) => (
                    <span key={city} className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] font-semibold">
                      {city}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white">How it works</h2>
            <p className="text-sm text-slate-400 mt-2">Simple, transparent, and fully human-reviewed.</p>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="p-4 rounded-2xl bg-[#141418] border border-white/10">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-300 text-xs font-black">{i + 1}</div>
                <s.icon className="w-5 h-5 text-white mt-3" />
                <div className="mt-2 text-sm font-bold text-white">{s.title}</div>
                <div className="text-xs text-slate-400 mt-1 leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Specs */}
        <section className="mt-14 p-6 rounded-2xl bg-[#141418] border border-white/10">
          <h2 className="text-xl font-black text-white">Creative specs</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div>
              <div className="text-sm font-bold text-emerald-300">Image</div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
                <li>Aspect ratio: 1:1 (square)</li>
                <li>Recommended: 1080 × 1080 px</li>
                <li>Formats: JPG, PNG, WEBP</li>
                <li>Max file size: 5 MB per image</li>
                <li>Up to 5 images per carousel</li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-300">Video</div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
                <li>Duration: up to 5 minutes</li>
                <li>Max size: 100 MB (MP4 / WEBM)</li>
                <li>Aspect ratio: 1:1 or 9:16</li>
                <li>Resolution: 1080p recommended</li>
                <li>Or paste a public YouTube / Vimeo link</li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-300">Copy</div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
                <li>Header: up to 60 characters</li>
                <li>Description: up to 140 characters</li>
                <li>Body (video/text): up to 500 characters</li>
                <li>CTA options: WhatsApp, Lead form, Website</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-14 text-center p-8 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/30">
          <h2 className="text-2xl md:text-3xl font-black text-white">Ready to launch your first campaign?</h2>
          <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
            Submit your brief in under 3 minutes. Our team gets back to you within 24 hours to confirm pricing and go live.
          </p>
          <button
            onClick={() => start("image")}
            className="mt-6 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black rounded-full inline-flex items-center gap-2"
          >
            Explore & Get Started <ChevronRight className="w-4 h-4" />
          </button>
        </section>
      </div>

      <AdvertInquiryModal open={open} onClose={() => setOpen(false)} initialTier={presetTier} />
    </PublicChrome>
  );
}
