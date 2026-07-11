import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, Wallet as WalletIcon, CreditCard, Building2, Smartphone, CheckCircle2, Tag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { enrollPaid, type EnrollCurrency, type EnrollPaymentMethod } from "@/lib/academy.functions";
import { getWalletBalances } from "@/lib/wallet.functions";
import { validateCoupon, topUpWallet } from "@/lib/marketplace.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice, formatMoney, LEGACY_USD_RATES } from "@/lib/fx-display";

function fmt(usd: number, cur: EnrollCurrency) {
  // Legacy USD-based display for wallet/cashback amounts that live in USD only.
  const val = usd * LEGACY_USD_RATES[cur];
  return cur === "USD"
    ? formatMoney(val, "USD")
    : formatMoney(val, cur);
}

const METHODS: { key: EnrollPaymentMethod; label: string; icon: typeof WalletIcon; hint: string }[] = [
  { key: "wallet", label: "Wallet balance", icon: WalletIcon, hint: "Instant · 2% cashback" },
  { key: "card", label: "Debit / Credit card", icon: CreditCard, hint: "Visa, Mastercard, Verve" },
  { key: "bank_transfer", label: "Bank transfer", icon: Building2, hint: "Local bank rails" },
  { key: "mobile_money", label: "Mobile money", icon: Smartphone, hint: "MTN, Airtel, MoMo" },
];

interface Course {
  id: string;
  title: string;
  instructorName: string;
  priceUSD: number;
  coverUrl: string | null;
  originalCurrency: EnrollCurrency;
  originalAmount: number;
  fxSnapshot: unknown;
}

export function CourseCheckoutModal({
  open,
  course,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  course: Course | null;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const { baseCurrency } = useOnboarding();
  const runEnroll = useServerFn(enrollPaid);
  const runBalances = useServerFn(getWalletBalances);
  const runCoupon = useServerFn(validateCoupon);
  const runTopUp = useServerFn(topUpWallet);

  const [method, setMethod] = useState<EnrollPaymentMethod>("wallet");
  const [couponInput, setCouponInput] = useState("");
  const [couponPct, setCouponPct] = useState(0);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [walletUSD, setWalletUSD] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [shortfall, setShortfall] = useState<number | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod("wallet");
    setCouponInput(""); setCouponPct(0); setCouponCode(null);
    setBusy(false); setDone(false); setShortfall(null); setToppingUp(false);
    runBalances()
      .then((b) => setWalletUSD(b.balances.USD ?? 0))
      .catch(() => setWalletUSD(0));
  }, [open, runBalances]);

  const grossUSD = course?.priceUSD ?? 0;
  const discountUSD = useMemo(() => {
    if (method === "wallet") return 0;
    return Number(((grossUSD * couponPct) / 100).toFixed(2));
  }, [grossUSD, couponPct, method]);
  const totalUSD = Math.max(0, Number((grossUSD - discountUSD).toFixed(2)));

  if (!open || !course) return null;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (method === "wallet") { toast.info("Coupons apply to card/bank/mobile only."); return; }
    setCouponBusy(true);
    try {
      const res = await runCoupon({ data: { code } });
      if (res.valid) {
        setCouponPct(res.discountPct);
        setCouponCode(res.code);
        toast.success(`Coupon applied — ${res.discountPct}% off`);
      } else {
        setCouponPct(0); setCouponCode(null);
        toast.error("Invalid or inactive coupon");
      }
    } finally {
      setCouponBusy(false);
    }
  };

  const doTopUp = async () => {
    if (shortfall == null) return;
    setToppingUp(true);
    try {
      const amount = Number((shortfall * LEGACY_USD_RATES[baseCurrency]).toFixed(2));
      await runTopUp({ data: { amount, currency: baseCurrency, method: "card" } });
      toast.success("Wallet topped up");
      const b = await runBalances();
      setWalletUSD(b.balances.USD ?? 0);
      setShortfall(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Top-up failed");
    } finally {
      setToppingUp(false);
    }
  };

  const enroll = async () => {
    setBusy(true); setShortfall(null);
    try {
      const res = await runEnroll({
        data: {
          courseId: course.id,
          displayCurrency: baseCurrency,
          paymentMethod: method,
          couponCode: method === "wallet" ? null : couponCode,
        },
      });
      if (res.walletShortfallUSD != null) {
        setShortfall(res.walletShortfallUSD);
        toast.error(`Wallet short by ${fmt(res.walletShortfallUSD, baseCurrency)}. Top up or switch method.`);
        return;
      }
      setDone(true);
      toast.success(res.cashbackUSD ? `Enrolled! +${fmt(res.cashbackUSD, baseCurrency)} cashback credited` : "Enrolled! Start learning below.");
      setTimeout(() => { onEnrolled(); }, 900);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const canPay =
    !busy && !done && totalUSD >= 0 &&
    (method !== "wallet" || (walletUSD != null && walletUSD >= totalUSD));

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1E1E24] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[#1E1E24] border-b border-white/10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Enroll in course</div>
            <h3 className="text-white font-black text-lg leading-tight mt-0.5 truncate">{course.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {done ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
              </div>
              <div className="text-white font-black text-lg">You're enrolled 🎉</div>
              <p className="text-sm text-slate-400 mt-1">Redirecting you to the course…</p>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Payment method</div>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => {
                    const active = method === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => { setMethod(m.key); if (m.key === "wallet") { setCouponPct(0); setCouponCode(null); } }}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          active
                            ? "bg-emerald-500/10 border-emerald-500/50"
                            : "bg-[#121214] border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <m.icon className={`w-4 h-4 ${active ? "text-emerald-300" : "text-slate-400"}`} />
                          <div className="text-sm font-semibold text-white">{m.label}</div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{m.hint}</div>
                        {m.key === "wallet" && walletUSD != null && (
                          <div className="text-[11px] text-emerald-300 mt-1">Balance: {fmt(walletUSD, baseCurrency)}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {method !== "wallet" && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Coupon code
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      className="flex-1 px-3 py-2 bg-[#121214] border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/50"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponBusy || !couponInput.trim()}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-slate-200 font-semibold disabled:opacity-50"
                    >
                      {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                  {couponCode && (
                    <div className="mt-2 text-[11px] text-emerald-300">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {couponCode} — {couponPct}% off applied
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 rounded-lg bg-[#121214] border border-white/10 space-y-1.5">
                <Row label="Course price" value={fmt(grossUSD, baseCurrency)} />
                {discountUSD > 0 && <Row label="Coupon discount" value={`- ${fmt(discountUSD, baseCurrency)}`} accent="text-emerald-300" />}
                {method === "wallet" && (
                  <Row label="Wallet cashback (2%)" value={`+ ${fmt(totalUSD * 0.02, baseCurrency)}`} accent="text-emerald-300" />
                )}
                <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-white font-bold">Total due</span>
                  <span className="text-white font-black text-lg">{fmt(totalUSD, baseCurrency)}</span>
                </div>
              </div>

              {shortfall != null && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200">
                  <div className="font-bold">Wallet balance too low</div>
                  <div className="mt-0.5">Short by {fmt(shortfall, baseCurrency)}. Top up via card to continue.</div>
                  <button
                    onClick={doTopUp}
                    disabled={toppingUp}
                    className="mt-2 px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    {toppingUp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Top up {fmt(shortfall, baseCurrency)}
                  </button>
                </div>
              )}

              <button
                onClick={enroll}
                disabled={!canPay}
                className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-sm inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {method === "wallet" ? "Pay from wallet" : "Continue to payment"} · {fmt(totalUSD, baseCurrency)}
              </button>
              <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                80% goes to the instructor · 20% to platform academy revenue · Secure ledgered payment.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${accent ?? "text-white"}`}>{value}</span>
    </div>
  );
}
