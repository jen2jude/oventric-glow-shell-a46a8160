import { useState } from "react";
import { ModalShell } from "./shared";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { formatMoney } from "@/lib/fx-display";

export function PayoutModal({ onClose }: { onClose: () => void }) {
  const { balances, baseCurrency } = useOnboarding();
  const [amount, setAmount] = useState("");
  
  return (
    <ModalShell title="Request Payout" onClose={onClose}>
      <div className="space-y-4">
        <div>
           <label className="text-xs text-slate-500 uppercase font-bold tracking-widest">Available Balance</label>
           <div className="text-xl font-black text-white">{formatMoney(balances[baseCurrency] ?? 0, baseCurrency)}</div>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase font-bold tracking-widest">Amount to Withdraw</label>
          <input 
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-[10px] py-3 px-4 text-white outline-none focus:border-[#E5484D]/50"
            placeholder="0.00"
          />
        </div>
        <button className="w-full bg-[#E5484D] text-white font-bold py-3 rounded-[10px] hover:brightness-110">
          Request Withdrawal
        </button>
      </div>
    </ModalShell>
  );
}
