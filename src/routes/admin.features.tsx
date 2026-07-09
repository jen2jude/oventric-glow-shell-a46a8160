import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { listFeatureFlags, setFeatureFlag } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/features")({
  head: () => ({ meta: [{ title: "Features · Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: FeaturesPage,
});

type Row = { id: string; key: string; description: string; enabled: boolean };

function FeaturesPage() {
  const listFn = useServerFn(listFeatureFlags);
  const setFn = useServerFn(setFeatureFlag);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => { listFn().then((r) => setRows(r as Row[])); }, [listFn]);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black">Feature Flags</h1>
        <p className="text-sm text-slate-400">Global toggles for platform modules.</p>
      </header>

      {!rows ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" /> : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No feature flags configured.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((f) => (
            <div key={f.id} className="bg-[#141418] border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-white font-bold font-mono text-sm">{f.key}</div>
                <div className="text-xs text-slate-500">{f.description || "—"}</div>
              </div>
              <button
                onClick={async () => { setBusy(f.id); await setFn({ data: { id: f.id, enabled: !f.enabled } }); refresh(); setBusy(null); }}
                disabled={busy === f.id}
                role="switch"
                aria-checked={f.enabled}
                className={`relative w-12 h-6 rounded-full transition-colors ${f.enabled ? "bg-emerald-500" : "bg-white/10"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${f.enabled ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
