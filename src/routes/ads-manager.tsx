import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, Loader2, Megaphone, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyCampaigns, type MyCampaignSummary } from "@/lib/my-ads.functions";

export const Route = createFileRoute("/ads-manager")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ads Manager — Oventric" },
      { name: "description", content: "Manage and track the performance of your ads on Oventric." },
    ],
  }),
  component: AdsManagerPage,
});

function AdsManagerPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyCampaigns);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<MyCampaignSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) { navigate({ to: "/" }); return; }
      setReady(true);
    });
    return () => { alive = false; };
  }, [navigate]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try { setRows(await listFn()); }
      catch { setRows([]); }
    })();
  }, [ready, listFn]);

  if (!ready || rows === null) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>

        <header className="mb-6 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-white text-2xl md:text-3xl font-black">Ads Manager</h1>
            <p className="text-slate-400 mt-1 text-sm">Manage and track the performance of your ads.</p>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#141418] p-8 text-center">
            <BarChart3 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <div className="text-white font-semibold">No campaigns yet</div>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              When our team publishes a campaign for you, it will appear here with live spend,
              reach, clicks and lead capture in real time.
            </p>
            <Link to="/advertise" className="inline-flex items-center gap-2 mt-4 rounded-lg bg-emerald-500 text-black px-4 py-2 text-sm font-semibold hover:bg-emerald-400">
              Start a campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((c) => <CampaignRow key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignRow({ c }: { c: MyCampaignSummary }) {
  const statusColor =
    c.status === "active" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
    c.status === "paused" ? "text-amber-400 bg-amber-500/10 border-amber-500/30" :
    c.status === "ended" ? "text-slate-400 bg-slate-500/10 border-slate-500/30" :
    "text-sky-400 bg-sky-500/10 border-sky-500/30";
  return (
    <Link
      to="/ads-manager/$id"
      params={{ id: c.id }}
      className="block rounded-xl border border-white/10 bg-[#141418] hover:border-white/20 transition p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-white font-semibold truncate">{c.title}</div>
            <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusColor}`}>{c.status}</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">{c.tier} · {c.cta_type.replace("_", " ")}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {c.placements.join(", ") || "no placements"} · {c.cities.length || 0} cities · {c.countries.join("/") || "global"}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        <Cell label="Spent" value={`$${c.spent_usd.toFixed(2)}`} />
        <Cell label="Budget" value={`$${c.total_budget_usd.toFixed(0)}`} />
        <Cell label="Impressions" value={c.impressions_total.toLocaleString()} />
        <Cell label="Clicks" value={c.clicks_total.toLocaleString()} />
      </div>
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">{label}</div>
      <div className="text-sm text-white font-black truncate">{value}</div>
    </div>
  );
}
