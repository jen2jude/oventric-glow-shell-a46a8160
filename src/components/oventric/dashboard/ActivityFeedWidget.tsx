import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Loader2, RefreshCcw } from "lucide-react";
import { myNotifications } from "@/lib/communications.functions";

interface ActivityRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ActivityFeedWidget() {
  const fetchFn = useServerFn(myNotifications);
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await fetchFn()) as ActivityRow[];
      setItems(rows.slice(0, 6));
    } catch (e) {
      setError((e as Error).message || "Couldn't load activity");
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white md:text-slate-900 flex items-center gap-1.5">
          <Activity className="w-4 h-4" /> Recent activity
        </h3>
        <button
          onClick={() => void load()}
          aria-label="Refresh activity"
          className="p-1.5 rounded-[10px] text-slate-400 md:text-slate-500 hover:text-white md:hover:text-slate-900 hover:bg-white/5 md:hover:bg-slate-100"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-2 text-xs text-red-400 py-8" role="alert">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button onClick={() => void load()} className="text-white underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : items === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-xs text-slate-400 md:text-slate-500 py-8">
          Nothing yet — your latest activity will show up here.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read_at ? "bg-slate-500" : "bg-emerald-400"}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white md:text-slate-900 truncate">
                  {n.title}
                </p>
                <p className="text-[11px] text-slate-400 md:text-slate-500">
                  {timeAgo(n.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
