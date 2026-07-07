import { Paperclip, Heart, MessageSquare, Share2, Sparkles, Target, Users } from "lucide-react";

export function Feed() {
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
          <button className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors">
            Post
          </button>
        </div>
      </div>

      {/* Social post */}
      <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-5">
        <header className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            AK
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm">Aria Kessler</div>
            <div className="text-xs text-slate-500">Staff Engineer · 2h ago</div>
          </div>
        </header>
        <p className="text-slate-300 text-sm leading-relaxed">
          Just shipped a zero-downtime migration on our multi-tenant Postgres cluster. RLS + logical replication saved
          us weeks. Happy to walk anyone through the setup.
        </p>
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/5 text-slate-400 text-xs">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-emerald-400 transition-colors">
            <Heart className="w-4 h-4" /> 128
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors">
            <MessageSquare className="w-4 h-4" /> 24
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition-colors ml-auto">
            <Share2 className="w-4 h-4" /> Share
          </button>
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
      <article className="relative bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-5 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold tracking-wide mb-3">
          <Target className="w-3 h-3" />
          [ACTIVE BOUNTY: $450 USD]
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
          <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg transition-colors">
            Solve &amp; Earn
          </button>
        </div>
      </article>
    </div>
  );
}
