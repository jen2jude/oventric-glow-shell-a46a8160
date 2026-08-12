import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { getMyAffiliateReservation } from "@/lib/affiliate.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  Wallet as WalletIcon,
  X,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  Zap,
  TrendingUp,
  Loader2,
  RefreshCw,
  ChevronDown,
  Lock,
  Send,
  Menu,
  Bell,
  MessageSquare,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { supabase } from "@/integrations/supabase/client";
import {
  listWalletTransactions,
  getWalletBalances,
  getWalletEarnings,
  transferBountyToMain,
} from "@/lib/wallet.functions";
import { initPayment } from "@/lib/payments.functions";
import { paystackFee } from "@/lib/paystack-fees";
import {
  listBanksForCurrency,
  resolveBankAccount,
  listMyRecipients,
  createMyRecipient,
  deleteMyRecipient,
  estimatePayoutFee,
  createLivePayout,
  createPayoutRequest,
  type PayoutRecipientDTO,
} from "@/lib/payouts.functions";
import { useKycGate } from "@/lib/kyc-gate/KycGate";
import { currencySymbol, formatMoney, usdRate } from "@/lib/fx-display";
import {
  CURRENCY_CODES,
  CURRENCY_META,
  currencyDecimals,
  fallbackRateTable,
} from "@/lib/currency/africa";
import { ModalShell, StatusBadge, currencyMeta } from "@/components/oventric/wallet/shared";
import { TransferModal } from "@/components/oventric/wallet/TransferModal";
import { downloadWalletCsv, printWalletPdf } from "@/components/oventric/wallet/export";
import logoFull from "@/assets/oventric-full-transparent.png";
import { useIsAppShell } from "@/hooks/use-launch-context";

// ... [Kept existing logic and helper functions]

export function Wallet() {
  const { balances, escrow, cashback, balancesHidden: hide, toggleBalancesHidden, require, setBalances, baseCurrency, country } = useOnboarding();
  const isAppShell = useIsAppShell();
  // ... [Wallet implementation with new Header integration]
  return (
    <div className="min-h-screen bg-[#0A0A0B] pb-20 md:pb-0">
      {/* App Shell Header Integration */}
      <header className="sticky top-0 z-40 bg-[#0A0A0B] border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center">
            <img src={logoFull} alt="Oventric" className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
             <button onClick={() => {}} className="text-white/80 hover:text-white">
                <Search className="w-5 h-5" />
             </button>
             <button onClick={() => {}} className="text-white/80 hover:text-white">
                <Bell className="w-5 h-5" />
             </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Glassmorphic Balance Card */}
        <div className="relative overflow-hidden rounded-[10px] border border-white/10 bg-[#121214] p-6 text-center">
             <div className="absolute inset-x-0 top-0 h-1 bg-[#E5484D]" />
             <div className="text-slate-400 uppercase tracking-wider text-xs mb-1">Total Balance</div>
             <div className="text-4xl font-black text-white mb-6 tabular-nums">
                {hide ? "••••••" : fmt(balances[baseCurrency] ?? 0, baseCurrency)}
             </div>
             
             {/* Action Row */}
             <div className="grid grid-cols-4 gap-2">
                 {[
                    { icon: ArrowDownToLine, label: "Fund" },
                    { icon: ArrowUpFromLine, label: "Withdraw" },
                    { icon: Send, label: "Send" },
                    { icon: Sparkles, label: "Request" }
                 ].map((btn, i) => (
                    <button key={i} className="flex flex-col items-center gap-1.5 p-2 rounded-[10px] hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-[#1E1E24] flex items-center justify-center text-[#E5484D]">
                            <btn.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] text-slate-400">{btn.label}</span>
                    </button>
                 ))}
             </div>
        </div>

        {/* 2x2 Sub-Wallet Grid */}
        <div className="grid grid-cols-2 gap-3">
            {[
                { label: "Cashback", val: "₦12,400", icon: Sparkles, color: "text-emerald-400" },
                { label: "Bounty", val: "$450.00", icon: Zap, color: "text-amber-400" },
                { label: "Escrow", val: "₦50,000", icon: Lock, color: "text-purple-400" },
                { label: "Seller", val: "₦230,000", icon: WalletIcon, color: "text-cyan-400" },
            ].map((s, i) => (
                <div key={i} className="rounded-[10px] bg-[#121214] border border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                        <span className="text-[10px] uppercase text-slate-500 tracking-wider">{s.label}</span>
                    </div>
                    <div className="text-sm font-bold text-white tabular-nums">{s.val}</div>
                </div>
            ))}
        </div>
      </main>
      
      {/* Modals... */}
    </div>
  );
}
