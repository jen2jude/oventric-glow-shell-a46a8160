import { useEffect, useState } from "react";
import { Store, Megaphone, Target, Clock } from "lucide-react";
import {
  useAdminStore,
  isAdActive,
  type AdminProduct,
  type AdminAd,
  type AdminBounty,
} from "@/lib/admin/store";

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type StatusKind = "live" | "scheduled" | "ended" | "published" | "active";

function StatusPill({ status, label }: { status: StatusKind; label: string }) {
  const styles: Record<StatusKind, string> = {
    live: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
    scheduled: "bg-amber-500/15 border-amber-500/40 text-amber-300",
    ended: "bg-slate-500/15 border-slate-500/40 text-slate-300",
    published: "bg-sky-500/15 border-sky-500/40 text-sky-300",
    active: "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[status]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function adStatus(ad: AdminAd, now: number): { status: StatusKind; label: string } {
  if (ad.startAt != null && now < ad.startAt) return { status: "scheduled", label: "Scheduled" };
  if (ad.endAt != null && now > ad.endAt) return { status: "ended", label: "Ended" };
  if (isAdActive(ad, now)) return { status: "live", label: "Live" };
  return { status: "ended", label: "Ended" };
}

type FilterKind = "all" | "assets" | "campaigns" | "bounties";

interface HistoryRow {
  id: string;
  kind: "asset" | "campaign" | "bounty";
  title: string;
  meta: string;
  createdAt: number;
  status: { status: StatusKind; label: string };
}

function toAssetRow(p: AdminProduct): HistoryRow {
  return {
    id: p.id,
    kind: "asset",
    title: p.name || "Untitled asset",
    meta: `${p.category} • v${p.version || "0.0.0"} • ${p.vendor || "House"}`,
    createdAt: p.createdAt,
    status: { status: "published", label: "Published" },
  };
}

function toCampaignRow(a: AdminAd, now: number): HistoryRow {
  return {
    id: a.id,
    kind: "campaign",
    title: a.advertiser || "Untitled campaign",
    meta: `${a.placement} • ${a.tier}`,
    createdAt: a.createdAt,
    status: adStatus(a, now),
  };
}

function toBountyRow(b: AdminBounty): HistoryRow {
  return {
    id: b.id,
    kind: "bounty",
    title: b.title || "Untitled bounty",
    meta: `${b.escrowCurrency} ${b.escrowAmount.toLocaleString()} • ${b.timeframe || "—"} • up to ${b.applicantLimit} solvers`,
    createdAt: b.createdAt,
    status: { status: "active", label: "Escrow Locked" },
  };
}

const KIND_ICON = {
  asset: Store,
  campaign: Megaphone,
  bounty: Target,
} as const;

export function AdminHistory() {
  const admin = useAdminStore();
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<FilterKind>("all");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const rows: HistoryRow[] = [
    ...admin.products.map(toAssetRow),
    ...admin.ads.map((a) => toCampaignRow(a, now)),
    ...admin.bounties.map(toBountyRow),
  ]
    .filter((r) => {
      if (filter === "all") return true;
      if (filter === "assets") return r.kind === "asset";
      if (filter === "campaigns") return r.kind === "campaign";
      return r.kind === "bounty";
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const counts = {
    all: admin.products.length + admin.ads.length + admin.bounties.length,
    assets: admin.products.length,
    campaigns: admin.ads.length,
    bounties: admin.bounties.length,
  };

  const filters: { key: FilterKind; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "assets", label: `Store Assets (${counts.assets})` },
    { key: "campaigns", label: `Ad Campaigns (${counts.campaigns})` },
    { key: "bounties", label: `Bounties (${counts.bounties})` },
  ];

  return (
    <section className="bg-[#1A1A1E] border border-white/10 rounded-2xl p-5">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-black text-base leading-tight">Recent Admin Activity</h2>
          </div>
          <p className="text-[11px] text-slate-500">
            Every forge, launch, and deploy from this session — newest first.
          </p>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filter === f.key
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                : "bg-[#121214] border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
          <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-semibold">No activity yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Forge an asset, launch a campaign, or deploy a bounty above to see it here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((r) => {
            const Icon = KIND_ICON[r.kind];
            return (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#121214] border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white truncate">{r.title}</span>
                    <StatusPill status={r.status.status} label={r.status.label} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{r.meta}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-semibold text-slate-300">
                    {relative(r.createdAt, now)}
                  </div>
                  <div className="text-[10px] text-slate-600">{formatTimestamp(r.createdAt)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
