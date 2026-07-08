import { useState, Fragment } from "react";
import { useAdminStore, useActiveAds } from "@/lib/admin/store";
import { AdCard as AdminAdCard } from "@/components/oventric/AdCard";
import {
  ArrowRight,
  ArrowLeft,
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  ShoppingBag,
  Target,
  Sparkles,
  Clock,
  Users,
  Star,
  Megaphone,
  GraduationCap,
  Package,
  FileCode,
  Palette,
  Puzzle,
  Blocks,
  Terminal,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };
const FX_FROM_USD: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };
function formatPrice(usd: number, cur: Currency) {
  const val = usd * FX_FROM_USD[cur];
  const rounded = cur === "USD" ? val.toFixed(0) : Math.round(val).toLocaleString();
  return `${CURRENCY_SYMBOL[cur]}${rounded}`;
}

interface MiniCourse {
  id: string;
  title: string;
  tag: string;
  hue: string;
}

const RECOMMENDED_COURSES: MiniCourse[] = [
  { id: "rc1", title: "React Server Components in Practice", tag: "React Engine", hue: "from-indigo-500 to-purple-700" },
  { id: "rc2", title: "Postgres Indexing Deep Dive", tag: "Database Core", hue: "from-emerald-500 to-teal-700" },
  { id: "rc3", title: "Tailwind v4 Theme Tokens", tag: "Design Systems", hue: "from-fuchsia-500 to-rose-700" },
  { id: "rc4", title: "Prompt Chaining for Agents", tag: "AI Workflows", hue: "from-amber-500 to-orange-700" },
  { id: "rc5", title: "Zero-Trust Session Rotation", tag: "Security Ops", hue: "from-red-500 to-rose-800" },
  { id: "rc6", title: "Edge Streaming with SSR", tag: "Frontend Perf", hue: "from-sky-500 to-blue-700" },
  { id: "rc7", title: "RLS Policy Testing at Scale", tag: "Supabase Core", hue: "from-cyan-500 to-emerald-700" },
  { id: "rc8", title: "Motion Choreography for UI", tag: "UI Motion", hue: "from-pink-500 to-purple-700" },
];

interface MiniAsset {
  id: string;
  name: string;
  category: string;
  priceUSD: number;
  Icon: React.ComponentType<{ className?: string }>;
  hue: string;
}

const SHOP_ASSETS: MiniAsset[] = [
  { id: "sa1", name: "Postgres RLS Starter", category: "Supabase Script", priceUSD: 49, Icon: Terminal, hue: "from-emerald-500 to-emerald-800" },
  { id: "sa2", name: "Nebula Admin Theme", category: "Dashboard Theme", priceUSD: 49, Icon: Palette, hue: "from-indigo-500 to-purple-600" },
  { id: "sa3", name: "Stripe Checkout Plus", category: "Payments Plugin", priceUSD: 35, Icon: Puzzle, hue: "from-purple-500 to-indigo-700" },
  { id: "sa4", name: "Hero Section Pack", category: "HTML Blocks", priceUSD: 15, Icon: Blocks, hue: "from-pink-500 to-rose-700" },
  { id: "sa5", name: "Auth Gateway", category: "Security Plugin", priceUSD: 45, Icon: Puzzle, hue: "from-amber-500 to-orange-700" },
  { id: "sa6", name: "Cron Runner Script", category: "Automation Script", priceUSD: 22, Icon: FileCode, hue: "from-blue-500 to-indigo-700" },
  { id: "sa7", name: "Aurora SaaS Kit", category: "Landing Theme", priceUSD: 79, Icon: Package, hue: "from-emerald-500 to-teal-600" },
  { id: "sa8", name: "Webhook Signer", category: "Utility Script", priceUSD: 11, Icon: FileCode, hue: "from-purple-500 to-fuchsia-700" },
];

type CategoryKey =
  | "all"
  | "frontend"
  | "uiux"
  | "ai"
  | "backend"
  | "security";

const CATEGORIES: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "✨ All Courses" },
  { key: "frontend", label: "💻 Frontend Dev" },
  { key: "uiux", label: "🎨 UI/UX Design" },
  { key: "ai", label: "🤖 AI Prompting" },
  { key: "backend", label: "🗄️ Backend & DB" },
  { key: "security", label: "🛡️ Cybersecurity" },
];

interface Course {
  id: string;
  title: string;
  category: Exclude<CategoryKey, "all">;
  instructor: string;
  duration: string;
  students: number;
  rating: number;
  priceUSD: number;
  hue: string;
  summary: string;
  syllabus: string[];
}

const COURSES: Course[] = [
  {
    id: "c1",
    title: "Advanced Supabase Architecture & Row-Level Security Matrix",
    category: "backend",
    instructor: "Kessler Labs",
    duration: "8h 24m",
    students: 1240,
    rating: 4.9,
    priceUSD: 89,
    hue: "from-emerald-500 to-teal-700",
    summary:
      "Master production-grade Postgres architecture with hardened RLS policies, security-definer patterns, and zero-recursion role matrices.",
    syllabus: [
      "Module 1 — Postgres foundations & schema design for multi-tenant apps",
      "Module 2 — Building the user_roles matrix without recursion",
      "Module 3 — Security-definer functions & privilege escalation defense",
      "Module 4 — RLS policy composition, testing, and CI enforcement",
      "Module 5 — Edge functions, service_role hardening & audit trails",
    ],
  },
  {
    id: "c2",
    title: "React 19 + TanStack Start: Server-Grade Frontend Systems",
    category: "frontend",
    instructor: "PixelForge",
    duration: "12h 10m",
    students: 2130,
    rating: 4.8,
    priceUSD: 79,
    hue: "from-indigo-500 to-purple-700",
    summary:
      "Ship SSR-ready React 19 apps with typed routing, server functions, and streaming data patterns used in production platforms.",
    syllabus: [
      "Module 1 — File-based routing & route context",
      "Module 2 — createServerFn: typed RPC end-to-end",
      "Module 3 — TanStack Query integration & suspense loaders",
      "Module 4 — Auth-gated layouts & middleware",
      "Module 5 — Deploying to edge runtimes",
    ],
  },
  {
    id: "c3",
    title: "Cinematic UI/UX for Multi-Vendor Marketplaces",
    category: "uiux",
    instructor: "Nightshade Studio",
    duration: "6h 45m",
    students: 980,
    rating: 4.7,
    priceUSD: 59,
    hue: "from-fuchsia-500 to-rose-700",
    summary:
      "Design premium dark-mode interfaces with structural typography, neon accent systems, and conversion-focused catalog layouts.",
    syllabus: [
      "Module 1 — Dark-mode color theory & token systems",
      "Module 2 — Typography hierarchy for high-density catalogs",
      "Module 3 — Motion & neon accent choreography",
      "Module 4 — Progressive disclosure & onboarding funnels",
    ],
  },
  {
    id: "c4",
    title: "Production Prompt Engineering with LLM Gateways",
    category: "ai",
    instructor: "Turbomesh AI",
    duration: "5h 30m",
    students: 1610,
    rating: 4.8,
    priceUSD: 49,
    hue: "from-amber-500 to-orange-700",
    summary:
      "Engineer resilient prompts, structured outputs, and cost-controlled agent workflows across GPT, Claude, and Gemini gateways.",
    syllabus: [
      "Module 1 — Prompt anatomy & few-shot patterns",
      "Module 2 — Structured outputs & JSON schema enforcement",
      "Module 3 — Tool-use, function calling & agent loops",
      "Module 4 — Cost, latency & observability",
    ],
  },
  {
    id: "c5",
    title: "Zero-Trust Auth Architectures for SaaS",
    category: "security",
    instructor: "Vaultly",
    duration: "9h 05m",
    students: 720,
    rating: 4.9,
    priceUSD: 99,
    hue: "from-red-500 to-rose-800",
    summary:
      "Design zero-trust identity flows with MFA, session rotation, device binding, and end-to-end audit surfaces.",
    syllabus: [
      "Module 1 — Threat modeling modern SaaS",
      "Module 2 — OAuth2, OIDC & PKCE deep dive",
      "Module 3 — Session rotation & device fingerprinting",
      "Module 4 — Audit logs, anomaly detection & response",
    ],
  },
  {
    id: "c6",
    title: "Postgres Performance: Indexes, Plans & Partitions",
    category: "backend",
    instructor: "Kessler Labs",
    duration: "7h 20m",
    students: 640,
    rating: 4.7,
    priceUSD: 69,
    hue: "from-cyan-500 to-blue-700",
    summary:
      "Diagnose slow queries, design covering indexes, and partition high-volume tables without downtime.",
    syllabus: [
      "Module 1 — Reading EXPLAIN plans like a native",
      "Module 2 — Btree, GIN, BRIN — index selection",
      "Module 3 — Partitioning strategies & maintenance",
      "Module 4 — Connection pooling & backpressure",
    ],
  },
  {
    id: "c7",
    title: "Design Systems in Tailwind v4: Tokens to Components",
    category: "uiux",
    instructor: "Baseline",
    duration: "4h 55m",
    students: 1120,
    rating: 4.6,
    priceUSD: 39,
    hue: "from-pink-500 to-purple-700",
    summary:
      "Build a scalable design system with semantic tokens, theme variables, and composable component primitives.",
    syllabus: [
      "Module 1 — Semantic tokens & @theme",
      "Module 2 — Component variants with CVA",
      "Module 3 — Dark mode & multi-brand theming",
    ],
  },
  {
    id: "c8",
    title: "Realtime UIs with WebSockets & Presence",
    category: "frontend",
    instructor: "SocketLab",
    duration: "6h 10m",
    students: 540,
    rating: 4.7,
    priceUSD: 55,
    hue: "from-sky-500 to-indigo-700",
    summary:
      "Ship live chat, collaborative cursors, and presence systems that scale past 10k concurrent users.",
    syllabus: [
      "Module 1 — WebSocket protocol & scaling patterns",
      "Module 2 — Presence & optimistic updates",
      "Module 3 — Reconnect strategies & backpressure",
    ],
  },
];

interface Bounty {
  id: string;
  title: string;
  amountUSD: number;
  category: Exclude<CategoryKey, "all">;
  applicants: number;
  closesIn: string;
}

const BOUNTIES: Bounty[] = [
  {
    id: "b1",
    title: "Ship a hardened user_roles matrix with RLS on Supabase",
    amountUSD: 450,
    category: "backend",
    applicants: 12,
    closesIn: "4d",
  },
  {
    id: "b2",
    title: "Design a token-gated onboarding funnel (Figma + spec)",
    amountUSD: 320,
    category: "uiux",
    applicants: 7,
    closesIn: "6d",
  },
  {
    id: "b3",
    title: "Build a prompt-eval harness with structured outputs",
    amountUSD: 280,
    category: "ai",
    applicants: 5,
    closesIn: "3d",
  },
];

interface Ad {
  id: string;
  tier: 2 | 3;
  brand: string;
  headline: string;
  cta: string;
  hue: string;
}

const ADS: Ad[] = [
  {
    id: "ad1",
    tier: 2,
    brand: "Vercel",
    headline: "Deploy your first edge app in 60 seconds.",
    cta: "Try free",
    hue: "from-slate-700 to-slate-900",
  },
  {
    id: "ad2",
    tier: 3,
    brand: "Payflow",
    headline: "Watch: Stripe checkout in 3 lines of code.",
    cta: "Play video",
    hue: "from-purple-700 to-indigo-900",
  },
];

export function Academy() {
  const { require, baseCurrency } = useOnboarding();
  const admin = useAdminStore();
  const academyAds = useActiveAds("academy");
  const [view, setView] = useState<"landing" | "catalog">("landing");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleEnroll = () => require(2, () => alert("Enrollment secured (mock)"));
  const handleBounty = () => require(2, () => alert("Applying to bounty (mock)"));
  const handleBuy = () => require(2, () => alert("Purchase confirmed (mock)"));

  if (view === "landing") {
    return <AcademyLanding onExplore={() => setView("catalog")} />;
  }

  const filtered =
    category === "all" ? COURSES : COURSES.filter((c) => c.category === category);

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Sticky category bar */}
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121214]/90 backdrop-blur border-b border-white/5">
        <button
          onClick={() => setView("landing")}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-1.5 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Academy Overview
        </button>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {academyAds.map((a) => (
          <AdminAdCard key={a.id} ad={a} variant="banner" />
        ))}
        {filtered.map((course, idx) => {
          const isExpanded = !!expanded[course.id];
          const injections: React.ReactNode[] = [];
          if ((idx + 1) % 3 === 0) {
            const bounty =
              BOUNTIES.find((b) => b.category === course.category) ??
              BOUNTIES[idx % BOUNTIES.length];
            injections.push(
              <BountyCard key={`b-${course.id}`} bounty={bounty} onApply={handleBounty} />,
            );
          }
          if ((idx + 1) % 4 === 0) {
            const ad = ADS[idx % ADS.length];
            injections.push(<AdCard key={`ad-${course.id}`} ad={ad} />);
          }

          return (
            <Fragment key={course.id}>
              <CourseCard
                course={course}
                expanded={isExpanded}
                onToggle={() =>
                  setExpanded((s) => ({ ...s, [course.id]: !s[course.id] }))
                }
                onEnroll={handleEnroll}
              />
              {injections}
            </Fragment>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            No courses in this category yet. Check back soon.
          </div>
        )}
      </div>

      {/* Shelf 1: Recommended Courses */}
      <div className="border-t border-white/5 mt-6 pt-8 px-4">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-white font-black text-lg md:text-xl inline-flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-400" />
            Recommended Courses For You
          </h2>
          <button className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            View full library →
          </button>
        </div>
        <div
          className="flex overflow-x-auto snap-x scrollbar-none gap-4 pb-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {RECOMMENDED_COURSES.map((mc) => (
            <div
              key={mc.id}
              className="w-[240px] snap-start bg-[#1E1E24] border border-white/5 rounded-xl p-3 flex-shrink-0 hover:border-white/15 transition-colors"
            >
              <div className={`relative aspect-video rounded-lg bg-gradient-to-br ${mc.hue} overflow-hidden`}>
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent 60%)",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-9 h-9 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  </span>
                </div>
              </div>
              <h3 className="mt-3 text-white font-bold text-sm leading-snug line-clamp-2">
                {mc.title}
              </h3>
              <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
                {mc.tag}
              </div>
              <button
                onClick={handleEnroll}
                className="mt-3 w-full text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center justify-center gap-1 border-t border-white/5 pt-2"
              >
                Quick Enroll <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Shelf 2: Shop Top Digital Assets */}
      <div className="mt-6 pt-4 px-4 pb-10">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-white font-black text-lg md:text-xl inline-flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            Shop Top Digital Assets
          </h2>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)]">
            <Sparkles className="w-3 h-3" /> Trending Marketplace Files
          </span>
        </div>
        <div
          className="flex overflow-x-auto snap-x scrollbar-none gap-4 pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {SHOP_ASSETS.map((a) => {
            const Icon = a.Icon;
            return (
              <div
                key={a.id}
                className="w-[220px] snap-start bg-[#1E1E24] border border-white/5 rounded-xl p-3 flex-shrink-0 hover:border-white/15 transition-colors flex flex-col"
              >
                <div className={`relative aspect-square rounded-lg bg-gradient-to-br ${a.hue} flex items-center justify-center`}>
                  <div
                    className="absolute inset-0 opacity-25 rounded-lg"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%)",
                    }}
                  />
                  <Icon className="relative w-10 h-10 text-white" />
                </div>
                <h3 className="mt-3 text-white font-bold text-sm leading-snug line-clamp-2">
                  {a.name}
                </h3>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {a.category}
                </div>
                <div className="mt-2 text-white font-black text-base">
                  {formatPrice(a.priceUSD, baseCurrency)}
                </div>
                <button
                  onClick={handleBuy}
                  className="mt-3 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors"
                >
                  Buy Now
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AcademyLanding({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-10 md:py-16">
      {/* Hero */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide mb-6">
          <Sparkles className="w-3.5 h-3.5" /> OVENTRIC ACADEMY
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-[1.05] tracking-tight">
          Master High-End Digital Skills.
          <br />
          <span className="text-slate-400">Solve Real Bounties.</span>{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
            Earn Capital.
          </span>
        </h1>
        <p className="mt-6 text-slate-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
          Oventric Academy pairs industry-standard technical training with our live gig
          economy. Every lesson unlocks a matching bounty — turn skill acquisition into
          revenue the same day you finish class.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onExplore}
            className="rgb-neon-bg rounded-2xl p-[2px] group"
          >
            <span className="flex items-center gap-3 bg-[#121214] group-hover:bg-[#1a1a20] transition-colors rounded-[14px] px-8 py-4 text-white font-black text-lg">
              Explore Courses <ArrowRight className="w-5 h-5" />
            </span>
          </button>
          <div className="text-xs text-slate-500 sm:ml-2">
            140+ courses · 24 active bounties · $28,400 in open payouts
          </div>
        </div>
      </div>

      {/* Value proposition grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14">
        <ValueCard
          Icon={Zap}
          title="Zero-Host Fast Streaming"
          body="Lessons stream instantly through Vimeo & YouTube-grade delivery. No buffering, no setup — press play and learn."
          accent="from-cyan-400 to-blue-600"
        />
        <ValueCard
          Icon={TrendingUp}
          title="Reputation Matrix"
          body="Every completed class boosts your developer score. Higher reputation unlocks premium bounties and invite-only briefs."
          accent="from-emerald-400 to-teal-600"
        />
        <ValueCard
          Icon={ShoppingBag}
          title="Contextual Shop Funnels"
          body="Access lesson-linked assets, starters, and plugins directly inside each module. Ship faster, right where you learn."
          accent="from-fuchsia-400 to-purple-600"
        />
      </div>

      {/* Secondary trust row */}
      <div className="mt-14 border-t border-white/5 pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        {[
          { k: "Learners", v: "24,180" },
          { k: "Courses", v: "142" },
          { k: "Instructors", v: "68" },
          { k: "Bounties paid", v: "$1.2M" },
        ].map((s) => (
          <div key={s.k}>
            <div className="text-2xl md:text-3xl font-black text-white">{s.v}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
              {s.k}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueCard({
  Icon,
  title,
  body,
  accent,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
      <div
        className={`w-11 h-11 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center mb-4`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-white font-bold text-base mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

function CourseCard({
  course,
  expanded,
  onToggle,
  onEnroll,
}: {
  course: Course;
  expanded: boolean;
  onToggle: () => void;
  onEnroll: () => void;
}) {
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden">
      {/* 16:9 thumbnail */}
      <div className={`relative aspect-video bg-gradient-to-br ${course.hue}`}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent 60%)",
          }}
        />
        <button
          onClick={onEnroll}
          className="absolute inset-0 flex items-center justify-center group"
          aria-label="Play preview"
        >
          <span className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Play className="w-7 h-7 md:w-8 md:h-8 text-white fill-white ml-1" />
          </span>
        </button>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/20 rounded px-2 py-1">
            {course.category}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[11px] text-white bg-black/60 border border-white/20 rounded px-2 py-1">
          <Clock className="w-3 h-3" /> {course.duration}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-white font-black text-lg md:text-xl leading-snug">
          {course.title}
        </h3>
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <span>By {course.instructor}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {course.students.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300">
            <Star className="w-3 h-3 fill-current" /> {course.rating.toFixed(1)}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-400 leading-relaxed line-clamp-2">
          {course.summary}
        </p>

        <button
          onClick={onToggle}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
        >
          {expanded ? (
            <>
              View Less Details <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              View More Details <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        <div
          className={`grid transition-all duration-300 ease-out ${
            expanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg bg-[#121214] border border-white/5 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Curriculum
              </div>
              <ul className="space-y-1.5">
                {course.syllabus.map((m, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-300 flex items-start gap-2"
                  >
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={onEnroll}
          className="mt-5 w-full py-3 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
        >
          Enroll & Begin Course · ${course.priceUSD}
        </button>
      </div>
    </div>
  );
}

function BountyCard({ bounty, onApply }: { bounty: Bounty; onApply: () => void }) {
  return (
    <div className="relative bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-5 shadow-[0_0_40px_-12px_rgba(16,185,129,0.55)]">
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider">
        <Target className="w-3 h-3" />
        ACTIVE BOUNTY · ${bounty.amountUSD} USD
      </div>
      <h3 className="mt-3 text-white font-bold text-base md:text-lg leading-snug">
        {bounty.title}
      </h3>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> {bounty.applicants} applicants
        </span>
        <span>Closes in {bounty.closesIn}</span>
      </div>
      <button
        onClick={onApply}
        className="mt-4 w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
      >
        Solve &amp; Earn
      </button>
    </div>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <Megaphone className="w-3 h-3" /> Sponsored · Tier {ad.tier}
        </span>
        <span className="text-[10px] text-slate-500">{ad.brand}</span>
      </div>
      {ad.tier === 3 ? (
        <div className={`relative aspect-video bg-gradient-to-br ${ad.hue}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
            <div className="text-white font-bold text-sm">{ad.headline}</div>
          </div>
        </div>
      ) : (
        <div className={`relative h-32 bg-gradient-to-br ${ad.hue} flex items-center px-5`}>
          <div className="text-white font-bold text-base md:text-lg max-w-md">
            {ad.headline}
          </div>
        </div>
      )}
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">Ad by {ad.brand}</span>
        <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold">
          {ad.cta}
        </button>
      </div>
    </div>
  );
}
