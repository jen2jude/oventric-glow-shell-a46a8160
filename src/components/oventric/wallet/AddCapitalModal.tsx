import { useState } from "react";
import { CheckCircle2, CreditCard, Landmark, Smartphone, Globe, ArrowRight } from "lucide-react";
import { ModalShell } from "./shared";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { formatMoney } from "@/lib/fx-display";

export function AddCapitalModal({ onClose }: { onClose: () => void }) {
  const { baseCurrency } = useOnboarding();
  const [step, setStep] = useState<"amount" | "method" | "qr">("amount");
  const [amount, setAmount] = useState("10000");

  const methods = [
    { id: 'bank', label: 'Bank Transfer', icon: Landmark, color: 'text-blue-400', desc: 'Instant via virtual account' },
    { id: 'card', label: 'Debit/Credit Card', icon: CreditCard, color: 'text-emerald-400', desc: 'Secure online payment' },
    { id: 'usdt', label: 'USDT (TRC20)', icon: Globe, color: 'text-teal-400', desc: 'Crypto settlement' },
    { id: 'minipay', label: 'MiniPay', icon: Smartphone, color: 'text-amber-400', desc: 'Fast mobile payment' },
  ];

  return (
    <ModalShell title="Add Funds" onClose={onClose}>
      {step === "amount" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {["10000", "20000", "50000", "100000", "250000", "500000"].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`p-3 rounded-[10px] border text-sm font-bold transition-all ${
                  amount === v 
                  ? "bg-[#E5484D] border-[#E5484D] text-white shadow-[0_0_15px_rgba(229,72,77,0.3)]" 
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                {formatMoney(Number(v), baseCurrency)}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[10px] py-4 pl-10 pr-4 text-xl font-black text-white outline-none focus:border-[#E5484D]/50"
              placeholder="0.00"
            />
          </div>
          <button
            onClick={() => setStep("method")}
            className="w-full bg-[#E5484D] text-white font-bold py-4 rounded-[10px] hover:brightness-110 flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === "method" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-bold">Select Payment Method</p>
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => m.id === 'minipay' ? setStep('qr') : null}
              className="w-full flex items-center gap-4 p-4 rounded-[10px] bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all text-left group"
            >
              <div className={`w-12 h-12 rounded-full bg-white/5 flex items-center justify-center ${m.color}`}>
                <m.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white group-hover:text-[#E5484D] transition-colors">{m.label}</div>
                <div className="text-xs text-slate-500">{m.desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-white" />
            </button>
          ))}
        </div>
      )}

      {step === "qr" && (
        <div className="text-center space-y-6 py-4">
          <div className="bg-white p-4 rounded-[20px] inline-block shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <div className="w-48 h-48 bg-slate-200 flex items-center justify-center text-slate-400">
              <Globe className="w-12 h-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-white">Scan to Pay</h4>
            <p className="text-sm text-slate-400 max-w-[240px] mx-auto">
              Scan the QR code with your MiniPay enabled wallet to complete payment of <b>{formatMoney(Number(amount), baseCurrency)}</b>
            </p>
          </div>
          <button
            onClick={() => setStep("method")}
            className="text-[#E5484D] text-sm font-bold hover:underline"
          >
            Cancel and try another method
          </button>
        </div>
      )}
    </ModalShell>
  );
}
