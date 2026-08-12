import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SettingsPage,
});

type Settings = {
  base_currency: string;
  live_fx_enabled: boolean;
  fx_rates: Record<string, number>;
};

function SettingsPage() {
  const getFn = useServerFn(getPlatformSettings);
  const upFn = useServerFn(updatePlatformSettings);
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getFn().then((r) =>
      setS(
        (r as Settings) ?? {
          base_currency: "USD",
          live_fx_enabled: false,
          fx_rates: { USD: 1, NGN: 1500, GHS: 14 },
        },
      ),
    );
  }, [getFn]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    try {
      await upFn({
        data: {
          base_currency: s.base_currency,
          live_fx_enabled: s.live_fx_enabled,
          fx_rates: s.fx_rates,
        },
      });
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <Loader2 className="w-5 h-5 animate-spin text-slate-500 mx-auto mt-10" />;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <header className="mb-4">
        <h1 className="text-white text-2xl font-black">Platform Settings</h1>
        <p className="text-sm text-slate-400">Base currency and FX rates.</p>
      </header>

      <div className="bg-[#141418] border border-white/10 rounded-xl p-5 grid gap-4">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
            Base currency
          </div>
          <select
            value={s.base_currency}
            onChange={(e) => setS({ ...s, base_currency: e.target.value })}
            className="w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white"
          >
            <option value="USD">USD</option>
            <option value="NGN">NGN</option>
            <option value="GHS">GHS</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={s.live_fx_enabled}
            onChange={(e) => setS({ ...s, live_fx_enabled: e.target.checked })}
          />
          Enable live FX (falls back to manual rates below when off)
        </label>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
            FX rates (1 base = X)
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(s.fx_rates).map(([code, rate]) => (
              <label key={code} className="block">
                <div className="text-xs text-slate-400 mb-1 font-mono">{code}</div>
                <input
                  type="number"
                  step="0.0001"
                  value={rate}
                  onChange={(e) =>
                    setS({ ...s, fx_rates: { ...s.fx_rates, [code]: Number(e.target.value) } })
                  }
                  className="w-full bg-[#0b0b0d] border border-white/10 rounded-[10px] px-3 py-2 text-sm text-white"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {msg && <span className="text-xs text-slate-400">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
