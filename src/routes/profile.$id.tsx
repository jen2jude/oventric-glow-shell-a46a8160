import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Star,
  MessageCircle,
  UserPlus,
  Check,
  Users,
  ShoppingBag,
  Target,
  Award,
  ShieldCheck,
  Send,
  X,
  Paperclip,
  Flag,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getProfile } from "@/lib/profiles/mockProfiles";
import { ReportModal } from "@/components/oventric/ReportModal";

export const Route = createFileRoute("/profile/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.id} · Oventric` },
      { name: "description", content: `Profile, listings, and bounties for ${params.id} on Oventric.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type Tab = "posts" | "groups" | "marketplace" | "posted" | "solved";

function ProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const profile = useMemo(() => getProfile(id), [id]);
  const { require, baseCurrency } = useOnboarding();

  const [tab, setTab] = useState<Tab>("posts");
  const [joined, setJoined] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const rep = profile.reputation;
  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = (usd: number) =>
    `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: baseCurrency === "USD" ? 0 : 0 })}`;

  const handleJoin = () =>
    require(1, () => setJoined((v) => !v));
  const handleChat = () => require(1, () => setDmOpen(true));

  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed top-0 bottom-0 left-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />
      <div className="pointer-events-none fixed top-0 bottom-0 right-0 w-[2px] z-50 rgb-neon-bg hidden md:block" />

      <div className="flex h-full flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="max-w-3xl mx-auto w-full px-4 py-6">
            <button
              onClick={() => navigate({ to: "/" })}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to feed
            </button>

            {/* Hero */}
            <section className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div
                  className={`w-20 h-20 rounded-full bg-gradient-to-br ${profile.avatarGradient} flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-lg`}
                >
                  {profile.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-white text-2xl font-black">{profile.name}</h1>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5">{profile.role}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Joined {profile.joined} · {profile.followers.toLocaleString()} followers
                  </div>
                  <p className="text-sm text-slate-300 mt-3 leading-relaxed">{profile.bio}</p>
                </div>
                <div className="flex sm:flex-col gap-2 sm:w-40 shrink-0">
                  <button
                    onClick={handleJoin}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      joined
                        ? "bg-emerald-500/15 border border-emerald-500/50 text-emerald-300"
                        : "bg-emerald-500 hover:bg-emerald-400 text-black"
                    }`}
                  >
                    {joined ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {joined ? "In Circle" : "Join Circle"}
                  </button>
                  <button
                    onClick={handleChat}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white hover:bg-white/5 text-sm font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" /> Chat
                  </button>
                  <button
                    onClick={() => setReportOpen(true)}
                    className="hidden sm:inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:bg-white/5 text-xs"
                  >
                    <Flag className="w-3.5 h-3.5" /> Report
                  </button>
                </div>
              </div>

              {/* Reputation block */}
              <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                <RepStat
                  icon={<Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                  label="Reputation"
                  value={
                    <div className="flex items-center gap-1">
                      <span className="text-white font-black">{rep.stars.toFixed(1)}</span>
                      <StarRow value={rep.stars} />
                    </div>
                  }
                />
                <RepStat
                  icon={<Target className="w-4 h-4 text-emerald-400" />}
                  label="Bounties Solved"
                  value={<span className="text-white font-black">{rep.bountiesSolved}</span>}
                />
                <RepStat
                  icon={<Award className="w-4 h-4 text-purple-400" />}
                  label="Courses"
                  value={<span className="text-white font-black">{rep.coursesCompleted}</span>}
                />
                <RepStat
                  icon={<ShoppingBag className="w-4 h-4 text-sky-400" />}
                  label="Sales"
                  value={<span className="text-white font-black">{rep.salesCount}</span>}
                />
                <RepStat
                  icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                  label="Dispute Rate"
                  value={<span className="text-white font-black">{rep.disputeRate}%</span>}
                />
              </div>
            </section>

            {/* Tabs */}
            <nav className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/10">
              {(
                [
                  ["posts", "Posts", profile.posts.length],
                  ["groups", "Groups", profile.groups.length],
                  ["marketplace", "Marketplace", profile.listings.length],
                  ["posted", "Bounties Posted", profile.bountiesPosted.length],
                  ["solved", "Bounties Solved", profile.bountiesSolved.length],
                ] as [Tab, string, number][]
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                    tab === key
                      ? "text-emerald-400 border-emerald-400"
                      : "text-slate-400 border-transparent hover:text-white"
                  }`}
                >
                  {label} <span className="text-xs text-slate-500 ml-1">({count})</span>
                </button>
              ))}
            </nav>

            {/* Tab content */}
            <section className="mt-5 space-y-3">
              {tab === "posts" &&
                profile.posts.map((p) => (
                  <article key={p.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                      <span>{profile.name}</span>
                      <span>·</span>
                      <span>{p.timeAgo}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{p.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span>❤ {p.likes}</span>
                      <span>💬 {p.comments}</span>
                    </div>
                  </article>
                ))}

              {tab === "groups" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {profile.groups.map((g) => (
                    <div key={g.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-black font-black">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-semibold text-sm truncate">{g.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {g.tag} · {g.members.toLocaleString()} members
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "marketplace" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {profile.listings.map((l) => (
                    <div key={l.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
                      <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                        {l.category}
                      </div>
                      <div className="text-white font-semibold text-sm mt-1">{l.title}</div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-white font-black text-lg">{price(l.priceUsd)}</div>
                        <div className="text-[11px] text-slate-500">{l.sales} sold</div>
                      </div>
                      <button
                        onClick={() => require(2, () => alert("Proceed to checkout (mock)"))}
                        className="mt-3 w-full px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs"
                      >
                        Buy Now
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {tab === "posted" &&
                (profile.bountiesPosted.length ? (
                  profile.bountiesPosted.map((b) => (
                    <article
                      key={b.id}
                      className="bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-5"
                    >
                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-300 mb-2">
                        <Target className="w-3.5 h-3.5" />
                        [ACTIVE · {price(b.amountUsd)}]
                      </div>
                      <h3 className="text-white font-bold leading-snug">{b.title}</h3>
                      <div className="text-xs text-slate-500 mt-2">
                        <Users className="w-3.5 h-3.5 inline mr-1" />
                        {b.applicants ?? 0} applicants
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState label="No open bounties posted." />
                ))}

              {tab === "solved" &&
                (profile.bountiesSolved.length ? (
                  profile.bountiesSolved.map((b) => (
                    <article key={b.id} className="bg-[#1E1E24] border border-white/10 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-purple-300 mb-2">
                        <Award className="w-3.5 h-3.5" />
                        [SOLVED · {price(b.amountUsd)}]
                      </div>
                      <h3 className="text-white font-bold leading-snug">{b.title}</h3>
                      {b.proof && (
                        <div className="mt-3 bg-black/30 border border-white/5 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                            Technical execution proof
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{b.proof}</p>
                          <button className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300">
                            View artifact <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <EmptyState label="No solved bounties yet." />
                ))}
            </section>
          </div>
        </main>
        <MobileNav
          onCreate={() => require(1)}
          active="Feed"
          onSelect={(l) => navigate({ to: "/" })}
        />
      </div>

      <DMDrawer open={dmOpen} onClose={() => setDmOpen(false)} profile={profile} />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={profile.name}
        targetId={`profile-${profile.id}`}
        targetKind="profile"
      />
    </div>
  );
}

function RepStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-black/30 border border-white/5 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center">
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value >= i + 1;
        const half = !filled && value >= i + 0.5;
        return (
          <Star
            key={i}
            className={`w-3 h-3 ${filled ? "fill-yellow-400 text-yellow-400" : half ? "fill-yellow-400/50 text-yellow-400/60" : "text-slate-600"}`}
          />
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function DMDrawer({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: ReturnType<typeof getProfile>;
}) {
  const [messages, setMessages] = useState(profile.dm);
  const [draft, setDraft] = useState("");

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMessages((m) => [...m, { from: "me", text: t, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setDraft("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          from: "them",
          text: "Got it — I'll circle back shortly.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 900);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-black/60 backdrop-blur-sm" />
      <aside className="w-full sm:w-[420px] max-w-full bg-[#1E1E24] border-l border-white/10 flex flex-col shadow-2xl">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div
            className={`w-9 h-9 rounded-full bg-gradient-to-br ${profile.avatarGradient} flex items-center justify-center text-white font-bold text-xs`}
          >
            {profile.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm truncate">{profile.name}</div>
            <div className="text-[11px] text-emerald-400">Active now</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.from === "me"
                    ? "bg-emerald-500 text-black rounded-br-sm"
                    : "bg-black/40 border border-white/10 text-slate-200 rounded-bl-sm"
                }`}
              >
                <div>{m.text}</div>
                <div className={`text-[10px] mt-0.5 ${m.from === "me" ? "text-black/60" : "text-slate-500"}`}>
                  {m.time}
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl pl-3 pr-1 py-1 focus-within:border-emerald-500/60">
            <button className="text-slate-400 hover:text-emerald-400" aria-label="Attach">
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Message ${profile.name.split(" ")[0]}…`}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none py-1.5"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
