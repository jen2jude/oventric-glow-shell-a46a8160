import { Paperclip, Heart, MessageSquare, Share2, Sparkles, Target, Users, ShoppingCart, Flag, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { ReportModal } from "@/components/oventric/ReportModal";
import { useAdminStore } from "@/lib/admin/store";
import { AdCard } from "@/components/oventric/AdCard";

interface Comment {
  id: string;
  author: string;
  authorId: string;
  initials: string;
  text: string;
}

function ReportedBadge() {
  return (
    <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
      <Flag className="w-3 h-3" /> Reported
    </span>
  );
}

export function Feed() {
  const { require, tier } = useOnboarding();
  const admin = useAdminStore();
  const feedAds = admin.ads.filter((a) => a.placement === "feed");
  const [likes, setLikes] = useState(128);
  const [liked, setLiked] = useState(false);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const markReported = (id: string) => setReported((s) => new Set(s).add(id));
  const [comments, setComments] = useState<Comment[]>([
    { id: "c1", author: "Devin Ortiz", authorId: "devin-ortiz", initials: "DO", text: "This saved me a week — thank you." },
  ]);
  const [draft, setDraft] = useState("");

  const handleLike = () =>
    require(1, () => {
      setLiked((v) => {
        setLikes((n) => n + (v ? -1 : 1));
        return !v;
      });
    });

  const handleBuy = () => require(2, () => alert("Proceeding to checkout (mock)"));
  const handleBounty = () => require(2, () => alert("Applying to bounty (mock)"));

  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    require(1, () => {
      setComments((c) => [...c, { id: `c${Date.now()}`, author: "You", authorId: "you", initials: "OV", text }]);
      setDraft("");
    });
  };

  const isLoggedIn = tier >= 1;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
      {/* Composer */}
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-4">
        <textarea
          rows={2}
          placeholder="What are you creating today? Seeking Technical Help?"
          className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none text-sm"
        />
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <button className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-sm transition-colors">
            <Paperclip className="w-4 h-4" />
            Attach
          </button>
          <button
            onClick={() => require(1)}
            className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            Post
          </button>
        </div>
      </div>

      {/* Social post */}
      <article className={`bg-[#1E1E24] border border-white/10 rounded-xl p-5 transition-opacity ${reported.has("post-aria-1") ? "opacity-70" : ""}`}>
        <header className="flex items-center gap-3 mb-3">
          <Link
            to="/profile/$id"
            params={{ id: "aria-kessler" }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0 hover:ring-2 hover:ring-emerald-400/60 transition"
          >
            AK
          </Link>
          <div className="min-w-0">
            <Link
              to="/profile/$id"
              params={{ id: "aria-kessler" }}
              className="font-semibold text-white text-sm hover:text-emerald-400 transition-colors"
            >
              Aria Kessler
            </Link>
            <div className="text-xs text-slate-500">Staff Engineer · 2h ago</div>
          </div>
          {reported.has("post-aria-1") ? (
            <ReportedBadge />
          ) : (
            <button
              onClick={() => setReportOpen("post-aria-1")}
              className="ml-auto p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
              aria-label="Report post"
              title="Report post"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </header>
        {reported.has("post-aria-1") && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
            <Flag className="w-3 h-3" />
            You reported this post. It's hidden from your feed pending review.
          </div>
        )}
        <p className="text-slate-300 text-sm leading-relaxed">
          Just shipped a zero-downtime migration on our multi-tenant Postgres cluster. RLS + logical replication saved
          us weeks. Happy to walk anyone through the setup.
        </p>
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/5 text-slate-400 text-xs">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors ${liked ? "text-emerald-400" : "hover:text-emerald-400"}`}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {likes}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors">
            <MessageSquare className="w-4 h-4" /> {comments.length}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors ml-auto">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>

        {/* Comments */}
        <div className="mt-4 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Link
                to="/profile/$id"
                params={{ id: c.authorId }}
                className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black text-[10px] font-bold"
              >
                {c.initials}
              </Link>
              <div className="flex-1 bg-black/30 border border-white/5 rounded-lg px-3 py-2">
                <Link
                  to="/profile/$id"
                  params={{ id: c.authorId }}
                  className="text-xs font-semibold text-white hover:text-emerald-400"
                >
                  {c.author}
                </Link>
                <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Inline comment input */}
        <div className="mt-3 flex items-center gap-2">
          <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black text-[10px] font-bold">
            OV
          </div>
          <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg pl-3 pr-1 py-1 focus-within:border-emerald-500/60 transition-colors">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder={isLoggedIn ? "Write a comment…" : "Sign in to comment"}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              onClick={submitComment}
              disabled={!draft.trim()}
              className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black"
              aria-label="Send comment"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </article>

      {/* Marketplace asset */}
      <article className="bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <Link to="/profile/$id" params={{ id: "aria-kessler" }} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-xs">
              KL
            </div>
            <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">Kessler Labs</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Marketplace</span>
            {reported.has("listing-rls-kit") ? (
              <ReportedBadge />
            ) : (
              <button
                onClick={() => setReportOpen("listing-rls-kit")}
                className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5"
                aria-label="Report listing"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>
        <div className="p-5">
          <h3 className="font-semibold text-white text-base mb-1">Postgres RLS Starter Kit</h3>
          <p className="text-sm text-slate-400 mb-4">
            Production-grade row-level security scaffolding with role enums, security-definer helpers, and typed policies.
          </p>
          <div className="flex items-center justify-between">
            <div className="text-white font-black text-xl">$49</div>
            <button
              onClick={handleBuy}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
            >
              <ShoppingCart className="w-4 h-4" /> Buy Now
            </button>
          </div>
        </div>
      </article>

      {/* Sponsored Native Ad */}
      <article className="bg-[#1E1E24] border border-white/10 rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Nebula Cloud</span>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sponsored</span>
        </header>
        <div className="relative h-40 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 overflow-hidden">
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, #10b981 0%, transparent 40%), radial-gradient(circle at 80% 70%, #6366f1 0%, transparent 40%)"
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/90 text-2xl font-black tracking-tight">DEPLOY IN 30s</span>
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-semibold text-white text-base mb-1">Ship globally with edge-native infra</h3>
          <p className="text-sm text-slate-400 mb-4">
            Nebula Cloud gives you sub-50ms cold starts across 40 regions. Free tier includes 10M requests/mo.
          </p>
          <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors">
            Learn More
          </button>
        </div>
      </article>

      {/* Bounty */}
      <article className={`relative bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-5 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] transition-opacity ${reported.has("bounty-rls") ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold tracking-wide mb-3">
            <Target className="w-3 h-3" />
            [ACTIVE BOUNTY: $450 USD]
          </div>
          {reported.has("bounty-rls") ? (
            <ReportedBadge />
          ) : (
            <button
              onClick={() => setReportOpen("bounty-rls")}
              className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5"
              aria-label="Report bounty"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            to="/profile/$id"
            params={{ id: "marco-tenreiro" }}
            className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-[10px] font-bold"
          >
            MT
          </Link>
          <Link
            to="/profile/$id"
            params={{ id: "marco-tenreiro" }}
            className="text-xs text-slate-400 hover:text-emerald-400"
          >
            Marco Tenreiro
          </Link>
        </div>
        <h3 className="text-white font-bold text-lg leading-snug mb-2">
          Need a clean custom user-roles matrix built for a Supabase backend
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Looking for RLS-first design with an enum-driven role table and a <code className="text-emerald-300 text-xs bg-black/30 px-1 rounded">has_role</code> security-definer function.
        </p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 12 applicants</span>
            <span>· Closes in 3 days</span>
          </div>
          <button
            onClick={handleBounty}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            Solve &amp; Earn
          </button>
        </div>
      </article>

      <ReportModal
        open={!!reportOpen}
        onClose={() => setReportOpen(null)}
        target={reportOpen?.startsWith("bounty") ? "bounty" : reportOpen?.startsWith("listing") ? "listing" : "post"}
        targetId={reportOpen ?? undefined}
        targetKind={reportOpen?.startsWith("bounty") ? "bounty" : reportOpen?.startsWith("listing") ? "listing" : "post"}
        onReported={markReported}
      />
    </div>
  );
}
