import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Target,
  Users,
  Clock,
  Megaphone,
  Star,
  GraduationCap,
  Package,
  Paperclip,
  Send,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Rocket,
  Lock,
  AlertTriangle,
  Wallet as WalletIcon,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { useAdminStore } from "@/lib/admin/store";

type Category = "all" | "frontend" | "database" | "api" | "uiux";

const FILTERS: Array<{ key: Category; label: string }> = [
  { key: "all", label: "All Tasks" },
  { key: "frontend", label: "Frontend Gigs" },
  { key: "database", label: "Database Ops" },
  { key: "api", label: "API Integrations" },
  { key: "uiux", label: "UI/UX Polishing" },
];

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };
const FX_FROM_USD: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };
function fmt(usd: number, cur: Currency) {
  const val = usd * FX_FROM_USD[cur];
  const rounded = cur === "USD" ? val.toFixed(0) : Math.round(val).toLocaleString();
  return `${CURRENCY_SYMBOL[cur]}${rounded}`;
}

interface Applicant {
  id: string;
  name: string;
  handle: string;
  rating: number;
  lmsMilestones: number;
  storeSales: number;
  pitch: string;
  hue: string;
}

interface Bounty {
  id: string;
  title: string;
  category: Exclude<Category, "all">;
  priceUSD: number;
  expiresAt: number; // ms epoch
  applicants: Applicant[];
  ownedByMe: boolean;
}

const now = Date.now();
const H = 3_600_000;

const BOUNTIES: Bounty[] = [
  {
    id: "b1",
    title: "Fix broken webhook synchronization loop between Supabase and Paystack API",
    category: "api",
    priceUSD: 450,
    expiresAt: now + 26 * H + 14 * 60_000,
    ownedByMe: true,
    applicants: [
      { id: "a1", name: "Ada Nwosu", handle: "@ada.builds", rating: 4.9, lmsMilestones: 5, storeSales: 18, pitch: "I've shipped 3 Paystack↔Supabase bridges with idempotent retry queues. I can reproduce your loop in staging and patch within 24h.", hue: "from-emerald-500 to-teal-700" },
      { id: "a2", name: "Kwesi Owusu", handle: "@kwesi.dev", rating: 4.8, lmsMilestones: 3, storeSales: 12, pitch: "Specialist in webhook signature drift. Will add HMAC verification and dead-letter table with structured logs.", hue: "from-indigo-500 to-purple-700" },
      { id: "a3", name: "Mira Okafor", handle: "@mira.stack", rating: 4.7, lmsMilestones: 4, storeSales: 7, pitch: "Recently solved a similar recursion bug for a fintech client — 6h turnaround. Includes Postgres advisory-lock fix.", hue: "from-fuchsia-500 to-rose-700" },
    ],
  },
  {
    id: "b2",
    title: "Ship a hardened user_roles matrix with RLS on Supabase",
    category: "database",
    priceUSD: 320,
    expiresAt: now + 71 * H,
    ownedByMe: false,
    applicants: [],
  },
  {
    id: "b3",
    title: "Refactor dashboard grid to use CSS container queries + Tailwind v4",
    category: "frontend",
    priceUSD: 210,
    expiresAt: now + 12 * H + 40 * 60_000,
    ownedByMe: false,
    applicants: [],
  },
  {
    id: "b4",
    title: "Design a token-gated onboarding funnel (Figma + spec)",
    category: "uiux",
    priceUSD: 280,
    expiresAt: now + 48 * H,
    ownedByMe: false,
    applicants: [],
  },
  {
    id: "b5",
    title: "Integrate Stripe Connect payouts with tiered marketplace splits",
    category: "api",
    priceUSD: 620,
    expiresAt: now + 96 * H,
    ownedByMe: false,
    applicants: [],
  },
  {
    id: "b6",
    title: "Optimize Postgres query plan for 40M-row analytics view",
    category: "database",
    priceUSD: 540,
    expiresAt: now + 34 * H,
    ownedByMe: false,
    applicants: [],
  },
  {
    id: "b7",
    title: "Polish empty-states + micro-interactions for wallet dashboard",
    category: "uiux",
    priceUSD: 180,
    expiresAt: now + 20 * H,
    ownedByMe: false,
    applicants: [],
  },
  {
    id: "b8",
    title: "Build realtime presence widget with WebSocket reconnect",
    category: "frontend",
    priceUSD: 260,
    expiresAt: now + 60 * H,
    ownedByMe: false,
    applicants: [],
  },
];

type ContractStatus = "escrow" | "review" | "released" | "revisions" | "disputed";
interface ChatMsg {
  id: string;
  from: "developer" | "poster" | "system";
  text: string;
  ts: number;
}

interface ContractState {
  bountyId: string;
  applicantId: string;
  status: ContractStatus;
  deadline: number; // project deadline
  reviewDeadline: number | null; // when in review state
  disputed: boolean;
  messages: ChatMsg[];
}

function useTicker(intervalMs = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00h 00m 00s";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function Bounties() {
  const { require, baseCurrency } = useOnboarding();
  const admin = useAdminStore();
  const [filter, setFilter] = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractState | null>(null);
  const [role, setRole] = useState<"poster" | "developer">("poster");

  useTicker(1000);

  const adminBounties: Bounty[] = useMemo(
    () =>
      admin.bounties.map((b) => {
        const fx: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };
        const usd = b.escrowAmount / fx[b.escrowCurrency];
        return {
          id: b.id,
          title: b.title,
          category: "api" as const,
          priceUSD: Math.round(usd),
          expiresAt: b.createdAt + 48 * 3_600_000,
          ownedByMe: false,
          applicants: [],
        };
      }),
    [admin.bounties],
  );

  const ALL_BOUNTIES = useMemo(() => [...adminBounties, ...BOUNTIES], [adminBounties]);

  const filtered = useMemo(
    () => (filter === "all" ? ALL_BOUNTIES : ALL_BOUNTIES.filter((b) => b.category === filter)),
    [filter, ALL_BOUNTIES],
  );

  const totalLocked = ALL_BOUNTIES.reduce((s, b) => s + b.priceUSD, 0);
  const activeCount = ALL_BOUNTIES.length;

  const selected = selectedId ? ALL_BOUNTIES.find((b) => b.id === selectedId) ?? null : null;

  // ------- Live contract workspace -------
  if (contract) {
    return (
      <ContractWorkspace
        contract={contract}
        setContract={setContract}
        role={role}
        setRole={setRole}
        currency={baseCurrency}
        bounty={BOUNTIES.find((b) => b.id === contract.bountyId)!}
        applicant={
          BOUNTIES.find((b) => b.id === contract.bountyId)!.applicants.find(
            (a) => a.id === contract.applicantId,
          )!
        }
        onExit={() => {
          setContract(null);
          setSelectedId(null);
        }}
      />
    );
  }

  // ------- Applicant evaluation -------
  if (selected) {
    return (
      <ApplicantEvaluation
        bounty={selected}
        currency={baseCurrency}
        onBack={() => setSelectedId(null)}
        onAssign={(applicantId) =>
          require(2, () => {
            setContract({
              bountyId: selected.id,
              applicantId,
              status: "escrow",
              deadline: Date.now() + 72 * H,
              reviewDeadline: null,
              disputed: false,
              messages: [
                {
                  id: "m0",
                  from: "system",
                  text: `Contract sealed. ${fmt(selected.priceUSD, baseCurrency)} locked in escrow.`,
                  ts: Date.now(),
                },
              ],
            });
          }, "issuer")
        }
      />
    );
  }

  // ------- Public board -------
  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-white text-2xl md:text-3xl font-black inline-flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" /> Bounty & Escrow Board
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Post work, evaluate applicants, run escrow-protected contracts end-to-end.
          </p>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-[#1E1E24] border border-emerald-500/30 rounded-xl p-4 shadow-[0_0_40px_-18px_rgba(16,185,129,0.7)]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 inline-flex items-center gap-1.5">
            <WalletIcon className="w-3 h-3" /> Total Locked in Escrow
          </div>
          <div className="mt-2 text-white text-2xl md:text-3xl font-black">
            {fmt(totalLocked, baseCurrency)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Across {activeCount} live contracts</div>
        </div>
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Active Tasks Seeking Solvers
          </div>
          <div className="mt-2 text-white text-2xl md:text-3xl font-black">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-1">Filtered live from open bounties</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                active
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                  : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Bounty stream */}
      <div className="space-y-3">
        {filtered.map((b, idx) => {
          const rows: React.ReactNode[] = [
            <BountyRow
              key={b.id}
              bounty={b}
              currency={baseCurrency}
              onOpen={() => require(2, () => setSelectedId(b.id))}
            />,
          ];
          if ((idx + 1) % 4 === 0) {
            rows.push(<AdSlot key={`ad-${b.id}`} tier={idx % 2 === 0 ? 1 : 2} />);
          }
          return rows;
        })}
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            No bounties match this filter yet.
          </div>
        )}
      </div>
    </div>
  );
}

function BountyRow({
  bounty,
  currency,
  onOpen,
}: {
  bounty: Bounty;
  currency: Currency;
  onOpen: () => void;
}) {
  const remaining = bounty.expiresAt - Date.now();
  return (
    <div className="bg-[#1E1E24] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider">
          <Target className="w-3 h-3" />
          ACTIVE BOUNTY · {fmt(bounty.priceUSD, currency)}
        </div>
        <h3 className="mt-2 text-white font-bold text-base md:text-lg leading-snug">
          {bounty.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Expires in {formatCountdown(remaining)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {bounty.applicants.length || Math.floor(Math.random() * 8) + 3} Developers Applied
          </span>
        </div>
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors whitespace-nowrap"
      >
        View Task &amp; Apply
      </button>
    </div>
  );
}

function AdSlot({ tier }: { tier: 1 | 2 }) {
  if (tier === 1) {
    return (
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-xs text-slate-400">
          <Megaphone className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sponsored · Tier 1</span>
          <span className="text-slate-300">Hire top-1% engineers on Contra — no fees.</span>
        </div>
        <button className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Learn more →</button>
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-r from-slate-800 via-slate-900 to-black">
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sponsored · Tier 2</div>
          <div className="mt-1 text-white font-bold text-sm md:text-base">
            Vercel: Ship your escrow API to the edge in 60 seconds.
          </div>
        </div>
        <button className="shrink-0 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold">
          Try free
        </button>
      </div>
    </div>
  );
}

function ApplicantEvaluation({
  bounty,
  currency,
  onBack,
  onAssign,
}: {
  bounty: Bounty;
  currency: Currency;
  onBack: () => void;
  onAssign: (applicantId: string) => void;
}) {
  useTicker(1000);
  const remaining = bounty.expiresAt - Date.now();
  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-1.5 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bounty Board
      </button>

      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 mb-5">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider">
          <Target className="w-3 h-3" />
          ACTIVE BOUNTY · {fmt(bounty.priceUSD, currency)}
        </div>
        <h2 className="mt-2 text-white text-xl md:text-2xl font-black leading-tight">{bounty.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> Expires in {formatCountdown(remaining)}</span>
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {bounty.applicants.length} pitches</span>
        </div>
      </div>

      <div className="text-white font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">
        Applicant Pitches
      </div>

      <div className="space-y-3">
        {bounty.applicants.map((a) => (
          <div key={a.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 flex flex-col md:flex-row gap-4">
            <div className={`shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${a.hue} flex items-center justify-center text-white font-black text-lg`}>
              {a.name.split(" ").map((p) => p[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-white font-bold">{a.name}</div>
                <div className="text-xs text-slate-500">{a.handle}</div>
                <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-current" /> {a.rating.toFixed(1)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
                  <GraduationCap className="w-3 h-3" /> {a.lmsMilestones} LMS Milestones
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] font-semibold">
                  <Package className="w-3 h-3" /> {a.storeSales} Store Sales
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-semibold">
                  <Star className="w-3 h-3" /> Reputation {(a.rating * 20).toFixed(0)}/100
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{a.pitch}</p>
            </div>
            <div className="shrink-0 md:self-center">
              <button
                onClick={() => onAssign(a.id)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors whitespace-nowrap"
              >
                Assign Task to Developer
              </button>
            </div>
          </div>
        ))}
        {bounty.applicants.length === 0 && (
          <div className="text-center text-slate-500 py-16 bg-[#1E1E24] border border-white/5 rounded-xl">
            No pitches yet on this bounty.
          </div>
        )}
      </div>
    </div>
  );
}

function ContractWorkspace({
  contract,
  setContract,
  role,
  setRole,
  currency,
  bounty,
  applicant,
  onExit,
}: {
  contract: ContractState;
  setContract: (c: ContractState | null) => void;
  role: "poster" | "developer";
  setRole: (r: "poster" | "developer") => void;
  currency: Currency;
  bounty: Bounty;
  applicant: Applicant;
  onExit: () => void;
}) {
  useTicker(1000);
  const [chatInput, setChatInput] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [releaseFlash, setReleaseFlash] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [contract.messages.length]);

  const isDisputed = contract.disputed;
  const status = contract.status;

  const sendMsg = () => {
    if (!chatInput.trim() || isDisputed) return;
    setContract({
      ...contract,
      messages: [
        ...contract.messages,
        { id: `m${Date.now()}`, from: role, text: chatInput.trim(), ts: Date.now() },
      ],
    });
    setChatInput("");
  };

  const submitWork = () => {
    if (isDisputed) return;
    setContract({
      ...contract,
      status: "review",
      reviewDeadline: Date.now() + 72 * H,
      messages: [
        ...contract.messages,
        { id: `m${Date.now()}`, from: "system", text: "Developer submitted work. 72-hour review window started." , ts: Date.now() },
      ],
    });
  };

  const approve = () => {
    if (isDisputed) return;
    setReleaseFlash(true);
    setContract({
      ...contract,
      status: "released",
      messages: [
        ...contract.messages,
        { id: `m${Date.now()}`, from: "system", text: `Funds released — ${fmt(bounty.priceUSD, currency)} paid to ${applicant.name}.`, ts: Date.now() },
      ],
    });
    setTimeout(() => setReleaseFlash(false), 2400);
  };

  const submitReject = () => {
    if (!rejectText.trim() || isDisputed) return;
    setContract({
      ...contract,
      status: "revisions",
      reviewDeadline: null,
      messages: [
        ...contract.messages,
        { id: `m${Date.now()}`, from: "system", text: `Delivery rejected. Bug log:\n${rejectText.trim()}` , ts: Date.now() },
      ],
    });
    setRejectText("");
    setRejectOpen(false);
  };

  const escalate = () => {
    setContract({
      ...contract,
      disputed: true,
      messages: [
        ...contract.messages,
        { id: `m${Date.now()}`, from: "system", text: "⚖️ Dispute escalated to arbiter. All actions frozen pending admin review.", ts: Date.now() },
      ],
    });
  };

  const projectRemaining = contract.deadline - Date.now();
  const reviewRemaining = contract.reviewDeadline ? contract.reviewDeadline - Date.now() : 0;

  const stages: Array<{ key: ContractStatus | "generic"; label: string }> = [
    { key: "escrow", label: "Funds In Escrow" },
    { key: "review", label: "Review Cycle" },
    { key: "released", label: "Payout Released" },
  ];
  const stageIndex =
    status === "escrow" || status === "revisions"
      ? 0
      : status === "review"
        ? 1
        : status === "released"
          ? 2
          : 0;

  return (
    <div className="relative max-w-6xl mx-auto w-full px-4 py-6">
      {releaseFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 rgb-neon-bg opacity-60 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/70 backdrop-blur border border-white/20 rounded-2xl px-8 py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto" />
              <div className="mt-2 text-white font-black text-xl">Payout Released</div>
              <div className="text-emerald-300 text-sm">{fmt(bounty.priceUSD, currency)} → {applicant.name}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Workspace
        </button>
        <div className="inline-flex items-center gap-2 text-xs">
          <span className="text-slate-500 uppercase tracking-wider">View as</span>
          <div className="inline-flex rounded-lg overflow-hidden border border-white/10 bg-[#1E1E24]">
            <button
              onClick={() => setRole("poster")}
              className={`px-3 py-1.5 font-semibold ${role === "poster" ? "bg-emerald-500 text-black" : "text-slate-300"}`}
            >
              Poster
            </button>
            <button
              onClick={() => setRole("developer")}
              className={`px-3 py-1.5 font-semibold ${role === "developer" ? "bg-emerald-500 text-black" : "text-slate-300"}`}
            >
              Developer
            </button>
          </div>
        </div>
      </div>

      {isDisputed && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/50 text-amber-200 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" /> [Dispute Logged — Admin Review Pending]
        </div>
      )}

      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4 mb-5">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider">
          <Lock className="w-3 h-3" /> LIVE CONTRACT · {fmt(bounty.priceUSD, currency)}
        </div>
        <h2 className="mt-2 text-white font-bold text-lg leading-snug">{bounty.title}</h2>
        <div className="mt-1 text-xs text-slate-400">
          Sealed with <span className="text-white font-semibold">{applicant.name}</span> {applicant.handle}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Left pane: chat */}
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl flex flex-col h-[560px] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 text-white font-bold text-sm">Peer Chat</div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {contract.messages.map((m) => (
              <ChatBubble key={m.id} msg={m} viewerRole={role} />
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-white/5 p-3 flex items-center gap-2">
            <button
              disabled={isDisputed}
              className="p-2 rounded-lg bg-[#121214] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMsg()}
              disabled={isDisputed}
              placeholder={isDisputed ? "Chat frozen — dispute in review" : `Message as ${role}…`}
              className="flex-1 bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-40"
            />
            <button
              onClick={sendMsg}
              disabled={isDisputed || !chatInput.trim()}
              className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right pane: escrow matrix */}
        <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4 flex flex-col gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Project Deadline
            </div>
            <div className="mt-1 text-white font-black text-2xl font-mono">
              {formatCountdown(projectRemaining)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {status === "revisions" ? "Paused — revisions requested" : "Ticking until penalty clauses activate"}
            </div>
          </div>

          {contract.reviewDeadline && status === "review" && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                72-Hour Review Window
              </div>
              <div className="mt-1 text-amber-200 font-mono text-sm">
                {formatCountdown(reviewRemaining)}
              </div>
            </div>
          )}

          {/* Stage tracker */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Contract Status</div>
            <div className="flex items-center gap-1">
              {stages.map((s, i) => {
                const active = i <= stageIndex;
                const isCurrent = i === stageIndex;
                return (
                  <div key={s.key} className="flex items-center gap-1 flex-1">
                    <div
                      className={`flex-1 rounded-md px-2 py-2 text-center text-[10px] font-bold border ${
                        active
                          ? isCurrent
                            ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200"
                            : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-[#121214] border-white/5 text-slate-500"
                      }`}
                    >
                      {i + 1}. {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
            {status === "revisions" && (
              <div className="mt-2 text-[11px] text-amber-300 font-semibold">
                ↻ Revisions Required — awaiting developer resubmission
              </div>
            )}
            {status === "released" && (
              <div className="mt-2 text-[11px] text-emerald-300 font-semibold">
                ✓ Funds released to developer wallet
              </div>
            )}
          </div>

          {/* Action zone */}
          <div className="flex-1 min-h-0" />

          <div className="space-y-2">
            {role === "developer" && (status === "escrow" || status === "revisions") && !isDisputed && (
              <button
                onClick={submitWork}
                className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
              >
                <Rocket className="w-4 h-4" /> Submit Work &amp; Request Release
              </button>
            )}

            {role === "poster" && status === "review" && !isDisputed && (
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={approve}
                  className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve &amp; Release Funds
                </button>
                <button
                  onClick={() => setRejectOpen((v) => !v)}
                  className="w-full py-3 rounded-lg bg-[#121214] border border-red-500/40 text-red-300 hover:bg-red-500/10 font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reject Delivery &amp; Log Issues
                </button>
                {rejectOpen && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-red-300">
                      Bug log
                    </label>
                    <textarea
                      value={rejectText}
                      onChange={(e) => setRejectText(e.target.value)}
                      rows={4}
                      placeholder="Describe the issues with this delivery…"
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                    />
                    <button
                      onClick={submitReject}
                      disabled={!rejectText.trim()}
                      className="mt-2 w-full py-2 rounded-lg bg-red-500 hover:bg-red-400 text-black font-bold text-sm disabled:opacity-40"
                    >
                      Submit Rejection
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === "released" && (
              <div className="text-center text-xs text-emerald-300 font-semibold py-2 border border-emerald-500/30 rounded-lg bg-emerald-500/10">
                Contract fulfilled. No further actions required.
              </div>
            )}

            <button
              onClick={escalate}
              disabled={isDisputed || status === "released"}
              className="w-full text-xs text-slate-400 hover:text-amber-300 inline-flex items-center justify-center gap-1.5 py-2 disabled:opacity-40"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> ⚖️ Escalate to Dispute Arbiter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  viewerRole,
}: {
  msg: ChatMsg;
  viewerRole: "poster" | "developer";
}) {
  if (msg.from === "system") {
    return (
      <div className="text-center">
        <span className="inline-block text-[11px] text-slate-400 bg-[#121214] border border-white/5 rounded-full px-3 py-1 whitespace-pre-wrap">
          {msg.text}
        </span>
      </div>
    );
  }
  const mine = msg.from === viewerRole;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
          mine
            ? "bg-emerald-500 text-black rounded-br-sm"
            : "bg-[#121214] border border-white/10 text-slate-200 rounded-bl-sm"
        }`}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">
          {msg.from === "poster" ? "Poster" : "Developer"}
        </div>
        {msg.text}
      </div>
    </div>
  );
}
