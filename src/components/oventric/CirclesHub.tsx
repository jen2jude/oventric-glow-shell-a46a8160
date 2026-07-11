import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Users,
  Flame,
  Search,
  Lock,
  Globe2,
  Target,
  X,
  ShoppingCart,
  Heart,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import { MOCK_CIRCLES, CIRCLE_CATEGORIES, type Circle, type CircleCategory } from "@/lib/circles-hub/mockCircles";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };
const FX_FROM_USD: Record<Currency, number> = { USD: 1, NGN: 1500, GHS: 14 };
function fmtPrice(usd: number, cur: Currency) {
  const val = usd * FX_FROM_USD[cur];
  const rounded = cur === "USD" ? val.toFixed(0) : Math.round(val).toLocaleString();
  return `${CURRENCY_SYMBOL[cur]}${rounded}`;
}
function fmtPeers(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export function CirclesHub() {
  const [circles, setCircles] = useState<Circle[]>(MOCK_CIRCLES);
  const [activeCategory, setActiveCategory] = useState<"All Guilds" | CircleCategory>("All Guilds");
  const [query, setQuery] = useState("");
  const [openCircle, setOpenCircle] = useState<Circle | null>(null);
  const [forgeOpen, setForgeOpen] = useState(false);

  const filtered = useMemo(() => {
    return circles.filter((c) => {
      const catOk = activeCategory === "All Guilds" || c.category === activeCategory;
      const q = query.trim().toLowerCase();
      const qOk = !q || c.name.toLowerCase().includes(q) || c.bio.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [circles, activeCategory, query]);

  const trending = useMemo(() => circles.filter((c) => c.trending), [circles]);

  if (openCircle) {
    return <CircleWorkspace circle={openCircle} onBack={() => setOpenCircle(null)} />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6">
      {/* Header row */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-6 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-white truncate">🛡️ Circles & Guilds</h1>
          <p className="text-sm text-slate-400 mt-1">Find your crew. Build together. Split the bag.</p>
        </div>
        <button
          onClick={() => setForgeOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Forge New Circle</span>
          <span className="sm:hidden">Forge</span>
        </button>
      </div>

      {/* Trending row */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-orange-400" />
          <h2 className="text-lg font-black text-white">Trending Circles</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto snap-x scrollbar-none pb-3 -mx-1 px-1">
          {trending.map((c) => (
            <TrendingCard key={c.id} circle={c} onOpen={() => setOpenCircle(c)} />
          ))}
        </div>
      </section>

      {/* Search + Category Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-5">
        <div className="relative sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guilds…"
            className="w-full bg-[#1E1E24] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none min-w-0">
          {CIRCLE_CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-[#1E1E24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <CircleCard key={c.id} circle={c} onOpen={() => setOpenCircle(c)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full bg-[#1E1E24] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">No circles match your filters yet. Try clearing the search or forging a new one.</p>
          </div>
        )}
      </div>

      {forgeOpen && (
        <ForgeCircleModal
          onClose={() => setForgeOpen(false)}
          onCreate={(c) => {
            setCircles((prev) => [c, ...prev]);
            setForgeOpen(false);
            setOpenCircle(c);
          }}
        />
      )}
    </div>
  );
}

function TrendingCard({ circle, onOpen }: { circle: Circle; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="snap-start shrink-0 w-[280px] sm:w-[320px] rgb-pulse-glow rounded-2xl text-left"
    >
      <div className="bg-[#1E1E24] rounded-[14px] overflow-hidden">
        <div className={`relative h-24 bg-gradient-to-br ${circle.bannerHue}`}>
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 55%)"
          }} />
          <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/60 text-orange-300 border border-orange-400/50 rounded px-1.5 py-0.5">
            <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Trending
          </span>
          <span className="absolute right-3 bottom-3 text-3xl drop-shadow">{circle.emoji}</span>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-white font-bold text-sm truncate">{circle.name}</h3>
            {circle.private && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
          </div>
          <div className="text-[11px] text-emerald-300 mb-2 truncate">{circle.category}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold text-slate-200">👤 {fmtPeers(circle.peers)}</span>
            <span>Peers Active</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function CircleCard({ circle, onOpen }: { circle: Circle; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden hover:border-emerald-500/40 transition-colors"
    >
      <div className={`relative h-20 bg-gradient-to-br ${circle.bannerHue}`}>
        <span className="absolute right-3 bottom-3 text-2xl drop-shadow">{circle.emoji}</span>
        {circle.private ? (
          <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/60 text-slate-200 border border-white/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" /> Private
          </span>
        ) : (
          <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/60 text-emerald-300 border border-emerald-400/50 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
            <Globe2 className="w-3 h-3" /> Public
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-white font-bold text-sm truncate">{circle.name}</h3>
          <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5 shrink-0">
            {circle.category}
          </span>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{circle.bio}</p>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> 👤 {fmtPeers(circle.peers)} Peers Active
          </span>
          <span className="text-emerald-300 font-semibold">Enter →</span>
        </div>
      </div>
    </button>
  );
}

/* ============================ Workspace ============================ */

type WorkspaceTab = "watercooler" | "bounties" | "resources";

function CircleWorkspace({ circle, onBack }: { circle: Circle; onBack: () => void }) {
  const [tab, setTab] = useState<WorkspaceTab>("watercooler");

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Top back bar */}
      <div className="sticky top-0 z-30 bg-[#121214]/90 backdrop-blur border-b border-white/5 px-4 py-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Group Discovery
        </button>
      </div>

      {/* Community Header */}
      <div className="px-4 pt-4">
        <div className={`relative h-40 sm:h-56 rounded-2xl overflow-hidden bg-gradient-to-br ${circle.bannerHue}`}>
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 55%)"
          }} />
          <span className="absolute right-6 bottom-6 text-6xl drop-shadow">{circle.emoji}</span>
        </div>

        <div className="relative -mt-8 sm:-mt-10 px-2 sm:px-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
            <div className="flex items-end gap-3 min-w-0">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-gradient-to-br ${circle.avatarHue} border-4 border-[#121214] grid place-items-center text-3xl sm:text-4xl`}>
                {circle.emoji}
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="text-xl sm:text-3xl font-black text-white truncate">{circle.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                    {circle.category}
                  </span>
                  <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {fmtPeers(circle.peers)} peers
                  </span>
                  {circle.private ? (
                    <span className="text-[10px] text-slate-300 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Private Vault
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300 inline-flex items-center gap-1">
                      <Globe2 className="w-3 h-3" /> Public Discovery
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="pb-1 shrink-0">
              <div className="rgb-neon-border-wrapper rounded-xl">
                <div className="bg-[#1E1E24] rounded-[10px] px-3 sm:px-4 py-2 sm:py-2.5">
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Total Group Bounty Earnings</div>
                  <div className="text-lg sm:text-2xl font-black text-emerald-300">
                    ${circle.totalEarningsUSD.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-3 max-w-2xl">{circle.bio}</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="px-4 mt-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-none border-b border-white/10">
          {(
            [
              { key: "watercooler", label: "💬 Guild Watercooler" },
              { key: "bounties", label: "🎯 Team Bounty Vault" },
              { key: "resources", label: "🗂 Shared Resources" },
            ] as const
          ).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  active ? "border-emerald-400 text-white" : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-6">
        {tab === "watercooler" && <WatercoolerTab circle={circle} />}
        {tab === "bounties" && <BountyVaultTab circle={circle} />}
        {tab === "resources" && <ResourcesTab circle={circle} />}
      </div>
    </div>
  );
}

/* ------- Tab A: Watercooler ------- */
function WatercoolerTab({ circle }: { circle: Circle }) {
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState(circle.posts);

  const submit = () => {
    if (!draft.trim()) return;
    setPosts((prev) => [
      {
        id: `local-${Date.now()}`,
        author: "You",
        initials: "YO",
        hue: "from-emerald-500 to-teal-700",
        time: "now",
        text: draft.trim(),
        likes: 0,
        comments: 0,
      },
      ...prev,
    ]);
    setDraft("");
  };

  const items: Array<{ kind: "post"; post: (typeof posts)[number] } | { kind: "ad"; id: string }> = [];
  posts.forEach((p, i) => {
    items.push({ kind: "post", post: p });
    if ((i + 1) % 4 === 0) items.push({ kind: "ad", id: `ad-${i}` });
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Composer */}
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Share a breakthrough with ${circle.name} · ask for a code review · request advice…`}
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none min-h-[70px]"
        />
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="text-[11px] text-slate-500">Members-only · {fmtPeers(circle.peers)} peers will see this</div>
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-semibold text-xs rounded-lg transition-colors"
          >
            Post to Guild
          </button>
        </div>
      </div>

      {items.map((it, idx) =>
        it.kind === "ad" ? (
          <NativeAdRow key={`${it.id}-${idx}`} />
        ) : (
          <PostRow key={it.post.id} post={it.post} />
        )
      )}
    </div>
  );
}

function PostRow({ post }: { post: { id: string; author: string; initials: string; hue: string; time: string; text: string; likes: number; comments: number } }) {
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-3.5">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-9 h-9 shrink-0 rounded-full bg-gradient-to-br ${post.hue} grid place-items-center text-[11px] font-bold text-white`}>
          {post.initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{post.author}</div>
          <div className="text-[11px] text-slate-500">{post.time}</div>
        </div>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{post.text}</p>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400">
        <button className="inline-flex items-center gap-1 hover:text-rose-400 transition-colors">
          <Heart className="w-3.5 h-3.5" /> {post.likes}
        </button>
        <button className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors">
          <MessageCircle className="w-3.5 h-3.5" /> {post.comments}
        </button>
      </div>
    </div>
  );
}

function NativeAdRow() {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="block bg-[#1E1E24] border border-fuchsia-500/30 hover:border-fuchsia-400/60 rounded-xl p-3.5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest bg-black/60 text-fuchsia-300 border border-fuchsia-400/50 rounded px-1.5 py-0.5">
          <Megaphone className="w-3 h-3 inline -mt-0.5 mr-0.5" /> Sponsored
        </span>
        <span className="text-[11px] text-slate-500">Promoted for this guild</span>
      </div>
      <div className="text-sm font-semibold text-white">Kessler Labs · Ship RLS-safe Postgres in an afternoon</div>
      <div className="text-xs text-slate-400 mt-0.5">Battle-tested policies, has_role helpers, and audit trails. 30% off this week.</div>
    </a>
  );
}

/* ------- Tab B: Bounty Vault ------- */
function BountyVaultTab({ circle }: { circle: Circle }) {
  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div className="bg-[#1E1E24] border border-emerald-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <div className="text-sm font-bold text-white">Team-bid enabled</div>
        </div>
        <p className="text-xs text-slate-400">
          Members can pool their profile star ratings and apply as a unified guild. Payouts split transparently across contributors on completion.
        </p>
      </div>

      {circle.bounties.map((b) => (
        <div key={b.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start sm:flex sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wide mb-2">
                <Target className="w-3 h-3" />
                ACTIVE BOUNTY · ${b.budgetUSD.toLocaleString()}
              </div>
              <h3 className="text-white font-bold text-sm sm:text-base leading-snug">{b.title}</h3>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 flex-wrap">
                <span>{b.applicants} guild applicants</span>
                <span>Closes in {b.closesInDays}d</span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Escrow-protected
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors whitespace-nowrap">
                Apply as a Guild
              </button>
              <button className="px-3 py-1.5 bg-[#121214] border border-white/10 hover:border-white/20 text-slate-200 font-medium text-xs rounded-lg transition-colors whitespace-nowrap">
                Solo apply
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------- Tab C: Resources ------- */
function ResourcesTab({ circle }: { circle: Circle }) {
  const { baseCurrency } = useOnboarding();
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-sm font-bold text-white">Guild-uploaded resources</h3>
        <div className="inline-flex items-center gap-2 bg-[#1E1E24] border border-white/10 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Priced in</span>
          <span className="text-[11px] font-bold text-emerald-300">{CURRENCY_SYMBOL[baseCurrency]} {baseCurrency}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {circle.assets.map((a) => (
          <div key={a.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-3 flex flex-col">
            <div className={`relative h-24 rounded-lg bg-gradient-to-br ${a.hue} mb-3 overflow-hidden`}>
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)" }} />
              <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/60 text-slate-100 border border-white/20 rounded px-1.5 py-0.5">
                {a.kind}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-white text-sm font-semibold truncate">{a.name}</h4>
              <div className="text-[11px] text-slate-500 truncate">by {a.vendor}</div>
            </div>
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
              <div className="text-white font-black text-base">{fmtPrice(a.priceUSD, baseCurrency)}</div>
              <button className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors">
                <ShoppingCart className="w-3.5 h-3.5" /> Buy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ Forge Modal ============================ */
function ForgeCircleModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Circle) => void }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState<CircleCategory>("SaaS Builders");
  const [isPrivate, setIsPrivate] = useState(false);

  const create = () => {
    if (!name.trim()) return;
    const id = `local-${Date.now()}`;
    onCreate({
      id,
      name: name.trim(),
      bio: bio.trim() || "A new guild forged by the sovereign creator.",
      category,
      peers: 1,
      totalEarningsUSD: 0,
      emoji: "🛡️",
      bannerHue: "from-emerald-500 via-teal-600 to-cyan-700",
      avatarHue: "from-emerald-500 to-teal-700",
      private: isPrivate,
      posts: [],
      bounties: [
        { id: "b1", title: `${category} · Seed bounty for founding members`, budgetUSD: 500, tag: category, applicants: 0, closesInDays: 14 },
      ],
      assets: [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#1E1E24] border border-white/10 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-black text-lg">Forge New Circle</h2>
            <p className="text-xs text-slate-400">Rally your peers under one banner.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Circle Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Edge Runtime Council"
              className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Scope / Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              placeholder="What will this guild ship together?"
              className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Category</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(CIRCLE_CATEGORIES.filter((c) => c !== "All Guilds") as CircleCategory[]).map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                        : "bg-[#121214] border-white/10 text-slate-300 hover:text-white"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Privacy</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsPrivate(false)}
                className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${
                  !isPrivate ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-[#121214] hover:border-white/20"
                }`}
              >
                <Globe2 className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">Public Discovery</div>
                  <div className="text-[10px] text-slate-400">Any builder can find & join.</div>
                </div>
              </button>
              <button
                onClick={() => setIsPrivate(true)}
                className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${
                  isPrivate ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-[#121214] hover:border-white/20"
                }`}
              >
                <Lock className="w-4 h-4 text-slate-200 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">Invite-Only Vault</div>
                  <div className="text-[10px] text-slate-400">Members join by invite only.</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 bg-[#121214]/50">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-bold text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Forge Circle
          </button>
        </div>
      </div>
    </div>
  );
}
