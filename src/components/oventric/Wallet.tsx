import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Menu,
  Bell,
  ScanLine,
  Eye,
  EyeOff,
  ShieldCheck,
  Info,
  Plus,
  ArrowUp,
  Send,
  ArrowDown,
  Sparkle,
  Zap,
  Lock,
  Wallet as WalletIcon,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getWalletBalances } from "@/lib/wallet.functions";
import { formatMoney, usdRate } from "@/lib/fx-display";
import { TransferModal } from "@/components/oventric/wallet/TransferModal";
import { AddCapitalModal } from "@/components/oventric/wallet/AddCapitalModal";
import { PayoutModal } from "@/components/oventric/wallet/PayoutModal";
import logoFull from "@/assets/oventric-full-transparent.png";
import wallet3d from "@/assets/wallet-3d.webp.asset.json";

function fmt(n: number, c: Currency) {
  return formatMoney(n, c);
}

export function Wallet() {
  const { balances: localBalances, balancesHidden: hide, toggleBalancesHidden, baseCurrency } = useOnboarding();
  const [transferOpen, setTransferOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(true);

  const fetchBalances = useServerFn(getWalletBalances);
  const { data } = useQuery({
    queryKey: ["wallet-balances"],
    queryFn: () => fetchBalances({}),
    retry: false,
  });

  const cur = baseCurrency;
  const available = data?.balances?.[cur] ?? localBalances[cur] ?? 0;
  const locked = data?.escrow?.[cur] ?? 0;
  const main = available + locked;
  const cashbackUSD = data?.cashback ?? 0;
  const bountyUSD = data?.bountyBalance ?? 0;
  const usdEquiv = main / (usdRate(cur) || 1);

  const mask = (v: string) => (hide ? "••••••" : v);

  const actions = [
    {
      label: "Add Funds",
      icon: Plus,
      ring: "bg-[#8B5CF6]",
      text: "text-white",
      onClick: () => setAddFundsOpen(true),
    },
    {
      label: "Withdraw",
      icon: ArrowUp,
      ring: "bg-transparent",
      text: "text-[#60A5FA]",
      onClick: () => setPayoutOpen(true),
    },
    {
      label: "Send",
      icon: Send,
      ring: "bg-transparent",
      text: "text-emerald-400",
      onClick: () => setTransferOpen(true),
    },
    {
      label: "Request",
      icon: ArrowDown,
      ring: "bg-[#6366F1]",
      text: "text-white",
      onClick: () => toast.info("Payment requests are coming soon"),
    },
  ];

  const subWallets = [
    {
      label: "Cashback Wallet",
      value: fmt(cashbackUSD * (usdRate(cur) || 1), cur),
      sub: "Redeem at checkout",
      icon: Sparkle,
      tone: "bg-[#2A1B3D] text-[#C084FC]",
      to: "/wallet/ledger" as const,
    },
    {
      label: "Bounty Earnings",
      value: fmt(bountyUSD * (usdRate(cur) || 1), cur),
      sub: "Earned from bounties",
      icon: Zap,
      tone: "bg-[#3A2A12] text-[#FBBF24]",
      to: "/wallet/ledger" as const,
    },
    {
      label: "Escrow Wallet",
      value: fmt(locked, cur),
      sub: "Locked in contracts",
      icon: Lock,
      tone: "bg-[#12283A] text-[#60A5FA]",
      to: "/wallet/ledger" as const,
    },
    {
      label: "Seller Earnings",
      value: fmt(available, cur),
      sub: "From marketplace sales",
      icon: WalletIcon,
      tone: "bg-[#0F2E23] text-[#34D399]",
      to: "/wallet/history" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0B] pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0A0A0B] px-4 h-14 flex items-center justify-between">
        <button aria-label="Menu" className="text-white/80 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/" className="flex items-center">
          <img src={logoFull} alt="Oventric" className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <button aria-label="Notifications" className="relative text-white/80 hover:text-white">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E5484D]" />
          </button>
          <button aria-label="Scan" className="text-white/80 hover:text-white">
            <ScanLine className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-3 space-y-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-2xl font-black tracking-tight">Sovereign Wallet</h1>
              <ShieldCheck className="w-5 h-5 text-[#F5A524]" />
            </div>
            <p className="text-[13px] text-slate-500 mt-1">
              Multi-currency · Cashback engine · Payout controls
            </p>
          </div>
          <button
            onClick={toggleBalancesHidden}
            aria-label={hide ? "Show balances" : "Hide balances"}
            className="w-11 h-11 shrink-0 rounded-[10px] bg-[#141418] border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            {hide ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Main balance card */}
        <div className="relative overflow-hidden rounded-[10px] border border-white/10 bg-gradient-to-br from-[#151327] via-[#101020] to-[#0C0C16] p-5">
          <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
          <img
            src={wallet3d.url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-3 top-10 w-36 opacity-95 select-none"
          />

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-slate-400">Main Balance</span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-bold text-white">
              {cur}
            </span>
          </div>

          <div className="mt-2 text-[40px] leading-none font-black text-white tabular-nums">
            {mask(fmt(main, cur))}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
            <span>≈ {mask(`$${usdEquiv.toFixed(2)}`)} USD</span>
            <Info className="w-3.5 h-3.5" />
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[13px] text-slate-500">Available Balance</div>
              <div className="text-lg font-bold text-white tabular-nums">{mask(fmt(available, cur))}</div>
            </div>
            <div>
              <div className="text-[13px] text-slate-500">Locked Balance</div>
              <div className="text-lg font-bold text-white tabular-nums">{mask(fmt(locked, cur))}</div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="rounded-[10px] bg-[#141418] border border-white/5 py-4 flex flex-col items-center gap-2 hover:bg-[#1A1A20] transition-colors"
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center ${a.ring} ${a.text}`}
              >
                <a.icon className="w-5 h-5" />
              </span>
              <span className="text-[12px] font-semibold text-white">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-wallets */}
        <section className="rounded-[10px] bg-[#111114] border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-base font-bold">My Sub-Wallets</h2>
            <button
              onClick={() => setSubOpen((v) => !v)}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#60A5FA]"
            >
              {subOpen ? "Hide" : "Show"}
              <ChevronUp className={`w-4 h-4 transition-transform ${subOpen ? "" : "rotate-180"}`} />
            </button>
          </div>

          {subOpen && (
            <div className="grid grid-cols-2 gap-3">
              {subWallets.map((s) => (
                <Link
                  key={s.label}
                  to={s.to}
                  className="rounded-[10px] bg-[#17171C] border border-white/5 p-3.5 hover:border-white/15 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${s.tone}`}>
                      <s.icon className="w-4 h-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-white leading-tight">{s.label}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xl font-black text-white tabular-nums truncate">
                        {mask(s.value)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 truncate">{s.sub}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mb-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {transferOpen && (
        <TransferModal
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            toast.success("Transfer completed");
          }}
        />
      )}
      {addFundsOpen && <AddCapitalModal onClose={() => setAddFundsOpen(false)} />}
      {payoutOpen && <PayoutModal onClose={() => setPayoutOpen(false)} />}
    </div>
  );
}

export { AddCapitalModal } from "./wallet/AddCapitalModal";
export { PayoutModal } from "./wallet/PayoutModal";
