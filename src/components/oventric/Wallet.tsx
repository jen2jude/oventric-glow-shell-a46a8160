import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Zap, CircleDollarSign, TrendingUp } from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";

const meta: Record<Currency, { symbol: string; label: string; accent: string }> = {
  USD: { symbol: "$", label: "US Dollars", accent: "from-emerald-500/20 to-emerald-500/0 border-emerald-500/30" },
  NGN: { symbol: "₦", label: "Nigerian Naira", accent: "from-sky-500/20 to-sky-500/0 border-sky-500/30" },
  GHS: { symbol: "₵", label: "Ghanaian Cedis", accent: "from-purple-500/20 to-purple-500/0 border-purple-500/30" },
};

function fmt(n: number, c: Currency) {
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: c === "NGN" ? 0 : 2, maximumFractionDigits: 2 };
  return meta[c].symbol + n.toLocaleString("en-US", opts);
}

export function Wallet() {
  const { balances, require, tier } = useOnboarding();
  const [route, setRoute] = useState<"A" | "B">("B");

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-black text-white tracking-tight">Wallet</h1>
        <p className="text-sm text-slate-400 mt-1">Multi-currency balances · cashback rewards · payout controls</p>
      </header>

      {/* Currency cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(meta) as Currency[]).map((c) => (
          <div key={c} className={`relative overflow-hidden rounded-xl border bg-[#1E1E24] p-5 ${meta[c].accent} bg-gradient-to-br`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white text-sm font-bold">
                  {meta[c].symbol}
                </div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{c}</span>
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white tabular-nums">{fmt(balances[c], c)}</div>
            <div className="text-xs text-slate-400 mt-1">{meta[c].label}</div>
          </div>
        ))}
      </div>

      {/* Payment route toggle */}
      <div className="rounded-xl border border-white/10 bg-[#1E1E24] p-5">
        <div className="flex items-center gap-2 mb-4">
          <CircleDollarSign className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Checkout route</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setRoute("A")}
            className={`text-left p-4 rounded-lg border transition-all ${
              route === "A" ? "border-emerald-500/60 bg-emerald-500/5" : "border-white/10 bg-[#121214] hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white text-sm">Route A · Direct gateway</span>
              <span className={`w-4 h-4 rounded-full border-2 ${route === "A" ? "border-emerald-400 bg-emerald-400" : "border-white/30"}`} />
            </div>
            <p className="text-xs text-slate-400">Card, bank transfer, or momo — standard processing fees apply.</p>
          </button>
          <button
            onClick={() => setRoute("B")}
            className={`text-left p-4 rounded-lg border transition-all ${
              route === "B" ? "border-emerald-500/60 bg-emerald-500/5" : "border-white/10 bg-[#121214] hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white text-sm">Route B · Pay with wallet</span>
              <span className={`w-4 h-4 rounded-full border-2 ${route === "B" ? "border-emerald-400 bg-emerald-400" : "border-white/30"}`} />
            </div>
            <p className="text-xs text-slate-400">Use your Oventric balance · unlocks instant cashback.</p>
          </button>
        </div>
        {route === "B" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">
              ⚡ Secure 2% to 5% Cashback Reward instantly by paying with your Oventric Wallet balance.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => require(4, () => alert("Deposit flow (mock)"))}
          className="group flex items-center justify-between p-5 rounded-xl border border-white/10 bg-[#1E1E24] hover:border-emerald-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Deposit</div>
              <div className="text-xs text-slate-400">Add funds to your vault</div>
            </div>
          </div>
          <span className="text-xs text-slate-500 group-hover:text-emerald-400">
            {tier >= 4 ? "Ready" : "Requires vault"}
          </span>
        </button>
        <button
          onClick={() => require(5, () => alert("Withdraw flow (mock)"))}
          className="group flex items-center justify-between p-5 rounded-xl border border-white/10 bg-[#1E1E24] hover:border-emerald-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ArrowUpFromLine className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Withdraw</div>
              <div className="text-xs text-slate-400">Payout to your bank / momo</div>
            </div>
          </div>
          <span className="text-xs text-slate-500 group-hover:text-emerald-400">
            {tier >= 5 ? "Ready" : "Requires KYC"}
          </span>
        </button>
      </div>
    </div>
  );
}
