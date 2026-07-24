import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, TrendingUp, Users, Gift, Check, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyAffiliateReservation,
  reserveAffiliateSpot,
  type AffiliateReservationDTO,
} from "@/lib/affiliate.functions";

export const Route = createFileRoute("/affiliate")({
  head: () => ({
    meta: [
      { title: "Affiliate Program · Reserve Your Early Seat · Oventric" },
      {
        name: "description",
        content:
          "Reserve your early spot in the Oventric Affiliate Program and earn recurring rewards when you refer new members, sellers, and course creators.",
      },
      { property: "og:title", content: "Oventric Affiliate Program — Reserve Early Seat" },
      {
        property: "og:description",
        content:
          "Be first in line when the Oventric Affiliate Program launches. Reserve your early seat today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const loadMine = useServerFn(getMyAffiliateReservation);
  const reserve = useServerFn(reserveAffiliateSpot);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [mine, setMine] = useState<AffiliateReservationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const isAuthed = !!data.session;
      setAuthed(isAuthed);
      if (isAuthed) {
        try {
          const r = await loadMine();
          if (!cancelled) setMine(r);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMine]);

  const onReserve = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const r = await reserve({ data: { note } });
      setMine(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reserve your spot");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-slate-200">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Oventric
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-[11px] uppercase tracking-widest font-bold mb-5">
          <Sparkles className="w-3.5 h-3.5" /> Coming Soon
        </div>

        <h1 className="text-white text-3xl sm:text-5xl font-black tracking-tight leading-tight">
          Earn with the Oventric<br />Affiliate Program.
        </h1>
        <p className="text-slate-400 mt-4 text-base sm:text-lg leading-relaxed max-w-2xl">
          Refer creators, sellers, and buyers. Get recurring rewards each time they transact on Oventric.
          Reserve your seat now to be first in line when we open the doors.
        </p>

        {/* Perks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
          {[
            { icon: TrendingUp, title: "Recurring rewards", body: "Earn on every purchase and enrollment made by people you invite." },
            { icon: Users, title: "Tiered payouts", body: "Level up your commission as your network grows." },
            { icon: Gift, title: "Founder bonuses", body: "Early-seat members unlock launch perks and higher rates." },
          ].map((p, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-[#141418] p-4">
              <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 mb-3">
                <p.icon className="w-4 h-4" />
              </div>
              <div className="text-white font-bold text-sm">{p.title}</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed">{p.body}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-700/5 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-fuchsia-300 animate-spin" />
            </div>
          ) : !authed ? (
            <div className="text-center">
              <div className="text-white font-black text-lg">Sign in to reserve your seat</div>
              <p className="text-sm text-slate-400 mt-1">You need an Oventric account to save your early-seat spot.</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 mt-4 px-5 py-3 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-black text-sm font-black"
              >
                Go sign in
              </Link>
            </div>
          ) : mine ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 mx-auto flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="text-white font-black text-lg">You have reserved your spot 🎉</div>
              <p className="text-sm text-slate-400 mt-1">
                We'll email <span className="text-white font-semibold">{mine.email}</span> when the affiliate
                program launches. Thanks for being an early believer.
              </p>
              <div className="text-[11px] text-slate-500 mt-3">
                Reserved on {new Date(mine.createdAt).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-white font-black text-lg">Reserve your early seat</div>
              <p className="text-sm text-slate-400 mt-1">
                No payment required. We'll notify you the moment the program launches.
              </p>
              <label className="block mt-4 text-[11px] uppercase tracking-widest text-slate-400 font-bold">
                Anything you'd like us to know? <span className="text-slate-600 normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Audience, niche, why you're excited..."
                rows={3}
                maxLength={500}
                className="mt-1.5 w-full bg-[#0b0b0d] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500/40"
              />
              {err && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-lg p-2">{err}</div>}
              <button
                onClick={onReserve}
                disabled={submitting}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-black text-sm font-black disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {submitting ? "Reserving..." : "Reserve my early seat"}
              </button>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-600 text-center mt-6">
          Reserving a seat does not obligate you to participate. You can opt out anytime.
        </p>
      </div>
    </div>
  );
}
