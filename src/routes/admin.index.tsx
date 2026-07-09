import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Package, ShoppingBag, DollarSign, Megaphone, Flag, Activity, Loader2 } from "lucide-react";
import { getAdminStats, getRecentActivity } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Overview · Admin · Oventric" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminOverview,
});

interface Stats {
  users: number; products: number; orders: number; revenueUsd: number;
  activeCampaigns: number; pendingReports: number; transactions: number;
}

function AdminOverview() {
  const statsFn = useServerFn(getAdminStats);
  const activityFn = useServerFn(getRecentActivity);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getRecentActivity>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([statsFn(), activityFn()])
      .then(([s, a]) => { setStats(s); setActivity(a); })
      .catch((e) => setErr((e as Error).message));
  }, [statsFn, activityFn]);

  if (err) return <div className="p-6 text-red-300 text-sm">{err}</div>;
  if (!stats || !activity) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>;

  const kpis = [
    { label: "Users", value: stats.users, icon: Users, tint: "text-blue-300 bg-blue-500/10 border-blue-500/30" },
    { label: "Products", value: stats.products, icon: Package, tint: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
    { label: "Orders", value: stats.orders, icon: ShoppingBag, tint: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
    { label: "Revenue (USD)", value: `$${stats.revenueUsd.toFixed(2)}`, icon: DollarSign, tint: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30" },
    { label: "Active Campaigns", value: stats.activeCampaigns, icon: Megaphone, tint: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" },
    { label: "Pending Reports", value: stats.pendingReports, icon: Flag, tint: "text-red-300 bg-red-500/10 border-red-500/30" },
    { label: "Wallet Txns", value: stats.transactions, icon: Activity, tint: "text-violet-300 bg-violet-500/10 border-violet-500/30" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-white text-2xl font-black">Overview</h1>
        <p className="text-sm text-slate-400">Real-time platform stats.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="bg-[#141418] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${k.tint}`}>
                <k.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-white text-2xl font-black">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Recent orders">
          {activity.orders.length === 0 ? <Empty label="No orders yet." /> : (
            <ul className="divide-y divide-white/5">
              {(activity.orders as Array<Record<string, unknown>>).map((o) => (
                <li key={o.id as string} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{String(o.id).slice(0, 8)}…</span>
                  <span className={`text-xs font-bold ${o.status === "paid" ? "text-emerald-300" : "text-slate-400"}`}>
                    ${Number(o.total_usd).toFixed(2)} · {o.status as string}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="New users">
          {activity.users.length === 0 ? <Empty label="No users yet." /> : (
            <ul className="divide-y divide-white/5">
              {(activity.users as Array<Record<string, unknown>>).map((u) => (
                <li key={u.user_id as string} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{(u.username as string) ?? String(u.user_id).slice(0, 8)}</span>
                  <span className="text-xs text-slate-500">{new Date(u.created_at as string).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Recent products">
          {activity.products.length === 0 ? <Empty label="No products yet." /> : (
            <ul className="divide-y divide-white/5">
              {(activity.products as Array<Record<string, unknown>>).map((p) => (
                <li key={p.id as string} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{p.name as string}</span>
                  <span className="text-xs text-emerald-300 font-bold">${Number(p.price_usd).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Audit trail">
          {activity.audit.length === 0 ? <Empty label="No admin actions yet." /> : (
            <ul className="divide-y divide-white/5">
              {(activity.audit as Array<Record<string, unknown>>).map((a) => (
                <li key={a.id as string} className="py-2 text-sm">
                  <div className="text-slate-200 font-mono text-xs">{a.action as string}</div>
                  <div className="text-[11px] text-slate-500">{new Date(a.created_at as string).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141418] border border-white/10 rounded-xl p-4">
      <h2 className="text-white text-sm font-bold mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return <p className="text-xs text-slate-500 py-4 text-center">{label}</p>;
}
