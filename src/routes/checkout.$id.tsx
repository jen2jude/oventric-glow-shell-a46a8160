import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  CreditCard,
  Building2,


  Smartphone,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/oventric/Header";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getProduct,
  createOrder,
  validateCoupon,
  WALLET_CASHBACK_PCT,
  type ProductDTO,
  type PaymentMethod,
} from "@/lib/marketplace.functions";
import { initPaystackPayment } from "@/lib/paystack.functions";
import { LEGACY_USD_RATES } from "@/lib/fx-display";

// Checkout works in USD canonical (the wallet is USD-native). Display
// conversion for the viewer uses the LEGACY fallback rates; the true locked
// price is shown on the product/listing card via computeDisplayPrice.
const FX_FROM_USD = LEGACY_USD_RATES;
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

function fmt(usd: number, cur: Currency) {
  const v = usd * FX_FROM_USD[cur];
  return `${CURRENCY_SYMBOL[cur]}${cur === "USD" ? v.toFixed(2) : Math.round(v).toLocaleString()}`;
}

/** Country-driven payment method availability. */
function methodsForCountry(country: string | null): Array<{ id: PaymentMethod; label: string; Icon: React.ComponentType<{ className?: string }>; hint: string }> {
  const base = [
    { id: "wallet" as PaymentMethod, label: "Oventric Wallet", Icon: WalletIcon, hint: "Instant. No processor fees." },
  ];
  if (country === "NG") {
    return [
      ...base,
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Verve, Mastercard, Visa" },
    ];
  }
  if (country === "GH") {
    return [
      ...base,
      { id: "mobile_money", label: "Mobile Money", Icon: Smartphone, hint: "MTN · Vodafone · AirtelTigo" },
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Mastercard, Visa" },
    ];
  }
  return [
    ...base,
    { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Global cards" },
  ];
}

export const Route = createFileRoute("/checkout/$id")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ qty: Math.max(1, Math.min(20, Number(s?.qty ?? 1) || 1)) }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id } = Route.useParams();
  const { qty } = Route.useSearch();
  const navigate = useNavigate();
  const { baseCurrency, country } = useOnboarding();

  const loadProduct = useServerFn(getProduct);
  const submitOrder = useServerFn(createOrder);
  const initPaystack = useServerFn(initPaystackPayment);
  const checkCoupon = useServerFn(validateCoupon);

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [balanceUSD, setBalanceUSD] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [submitting, setSubmitting] = useState(false);
  const [shortfallUSD, setShortfallUSD] = useState<number | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpMethod, setTopUpMethod] = useState<PaymentMethod>("card");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; discountPct: number } | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);

  const methods = useMemo(() => methodsForCountry(country), [country]);
  const subtotalUSD = useMemo(() => (product ? product.priceUSD * qty : 0), [product, qty]);
  const canUseCoupon = method !== "wallet";
  const discountUSD = useMemo(
    () => (canUseCoupon && coupon ? Number(((subtotalUSD * coupon.discountPct) / 100).toFixed(2)) : 0),
    [canUseCoupon, coupon, subtotalUSD],
  );
  const totalUSD = Number((subtotalUSD - discountUSD).toFixed(2));


  useEffect(() => {
    let cancelled = false;
    loadProduct({ data: { id } })
      .then((p) => { if (!cancelled) setProduct(p); })
      .catch((e: Error) => { if (!cancelled) setLoadErr(e.message || "Failed to load"); });
    return () => { cancelled = true; };
  }, [id, loadProduct]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("wallets").select("available_balance").eq("user_id", uid).eq("currency", "USD").maybeSingle();
      if (!cancelled) setBalanceUSD(Number(data?.available_balance ?? 0));
    };
    refresh();
    return () => { cancelled = true; };
  }, [shortfallUSD, topUpBusy]);

  const insufficient = method === "wallet" && balanceUSD !== null && balanceUSD < totalUSD;

  const pay = async () => {
    if (!product || submitting) return;
    setSubmitting(true);
    setShortfallUSD(null);
    try {
      // Non-wallet methods: initialize Paystack and redirect to secure checkout.
      if (method !== "wallet") {
        const channel: "card" | "bank_transfer" | "mobile_money" | undefined =
          method === "card" ? "card"
          : method === "bank_transfer" ? "bank_transfer"
          : method === "mobile_money" ? "mobile_money"
          : undefined;
        const init = await initPaystack({
          data: {
            purpose: "order",
            productId: product.id,
            quantity: qty,
            displayCurrency: baseCurrency,
            couponCode: canUseCoupon && coupon ? coupon.code : null,
            channel,
          },
        });
        window.location.href = init.authorizationUrl;
        return;
      }

      const res = await submitOrder({
        data: {
          productId: product.id,
          quantity: qty,
          displayCurrency: baseCurrency,
          paymentMethod: method,
          couponCode: canUseCoupon && coupon ? coupon.code : null,
        },
      });
      if (res.walletShortfallUSD && res.walletShortfallUSD > 0) {
        setShortfallUSD(res.walletShortfallUSD);
        setTopUpOpen(true);
        setTopUpAmount(String(Math.ceil(res.walletShortfallUSD * FX_FROM_USD[baseCurrency])));
        toast.error("Wallet balance too low", { description: `Top up ${fmt(res.walletShortfallUSD, baseCurrency)} to continue.` });
        return;
      }
      if (res.cashbackUSD && res.cashbackUSD > 0) {
        toast.success("Payment successful", { description: `${fmt(res.cashbackUSD, baseCurrency)} cashback credited to your wallet.` });
      } else {
        toast.success("Payment successful");
      }
      navigate({ to: "/order/$id", params: { id: res.order.id } });

    } catch (e) {
      toast.error("Payment failed", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const runTopUp = async () => {
    const amt = Number(topUpAmount);
    if (!(amt > 0)) { toast.error("Enter a valid amount"); return; }
    setTopUpBusy(true);
    try {
      const channel = topUpMethod === "card" ? "card" : topUpMethod === "bank_transfer" ? "bank_transfer" : topUpMethod === "mobile_money" ? "mobile_money" : "card";
      const init = await initPaystack({
        data: {
          purpose: "wallet_topup",
          amount: amt,
          currency: baseCurrency,
          channel,
          returnTo: `/checkout/${id}?qty=${qty}`,
        },
      });
      window.location.href = init.authorizationUrl;
    } catch (e) {
      toast.error("Top-up failed", { description: e instanceof Error ? e.message : "Try again." });
      setTopUpBusy(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#121214] text-slate-200">
      <Header onOpenMessages={() => {}} />
      <main className="max-w-4xl mx-auto w-full px-4 py-6 pb-24">
        <Link
          to="/product/$id"
          params={{ id }}
          search={{ qty }}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl md:text-3xl font-black text-white mb-6">Checkout</h1>

        {loadErr && (
          <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-6 text-sm text-red-300">
            {loadErr}
          </div>
        )}

        {!product && !loadErr && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
          </div>
        )}

        {product && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment methods */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Payment Method</h2>
              {methods.map((m) => {
                const active = method === m.id;
                const Icon = m.Icon;
                const walletTag = m.id === "wallet" && balanceUSD !== null;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`w-full text-left rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                      active
                        ? "bg-emerald-500/10 border-emerald-500/50"
                        : "bg-[#1E1E24] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? "bg-emerald-500/20" : "bg-white/5"}`}>
                      <Icon className={`w-5 h-5 ${active ? "text-emerald-300" : "text-slate-300"}`} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white font-semibold">{m.label}</span>
                      <span className="block text-xs text-slate-500">{m.hint}</span>
                    </span>
                    {walletTag && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {fmt(balanceUSD ?? 0, baseCurrency)}
                      </span>
                    )}
                  </button>
                );
              })}

              {insufficient && (
                <div className="mt-2 flex items-start gap-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div>
                      Wallet has {fmt(balanceUSD ?? 0, baseCurrency)} — you need {fmt(totalUSD, baseCurrency)}.
                    </div>
                    <button
                      onClick={() => {
                        const shortfall = Math.max(0, totalUSD - (balanceUSD ?? 0));
                        setShortfallUSD(shortfall);
                        setTopUpAmount(String(Math.ceil(shortfall * FX_FROM_USD[baseCurrency])));
                        setTopUpOpen(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-black"
                    >
                      Fund Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 h-max">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Order Summary</h2>
              <div className={`h-20 rounded-lg bg-gradient-to-br ${product.hue} mb-3`} />
              <div className="text-white font-semibold text-sm mb-1">{product.name}</div>
              <div className="text-xs text-slate-500 mb-3">by {product.vendor} · Qty {qty}</div>

              {canUseCoupon && (
                <div className="border-t border-white/5 pt-3 mb-3">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Coupon Code</div>
                  {coupon ? (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2">
                      <div className="text-xs">
                        <div className="text-emerald-300 font-bold font-mono">{coupon.code}</div>
                        <div className="text-[11px] text-slate-400">{coupon.discountPct}% off applied</div>
                      </div>
                      <button
                        onClick={() => { setCoupon(null); setCouponInput(""); setCouponErr(null); }}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }}
                          placeholder="Enter code"
                          className="flex-1 bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase"
                        />
                        <button
                          onClick={async () => {
                            const code = couponInput.trim();
                            if (!code) return;
                            setCouponBusy(true); setCouponErr(null);
                            try {
                              const r = await checkCoupon({ data: { code } });
                              if (r.valid) {
                                setCoupon({ code: r.code, discountPct: r.discountPct });
                                toast.success("Coupon applied", { description: `${r.discountPct}% off your order.` });
                              } else {
                                setCouponErr("Invalid or expired code");
                              }
                            } catch (e) {
                              setCouponErr(e instanceof Error ? e.message : "Failed");
                            } finally {
                              setCouponBusy(false);
                            }
                          }}
                          disabled={couponBusy || !couponInput.trim()}
                          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold disabled:opacity-50"
                        >
                          {couponBusy ? "…" : "Apply"}
                        </button>
                      </div>
                      {couponErr && <div className="text-[11px] text-red-300 mt-1.5">{couponErr}</div>}
                      <div className="text-[11px] text-slate-500 mt-1.5">Try <span className="font-mono text-slate-400">SAVE2</span> for 2% off.</div>
                    </>
                  )}
                </div>
              )}

              <div className="border-t border-white/5 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmt(subtotalUSD, baseCurrency)}</span></div>
                {discountUSD > 0 && (
                  <div className="flex justify-between text-emerald-300"><span>Discount ({coupon?.discountPct}%)</span><span>− {fmt(discountUSD, baseCurrency)}</span></div>
                )}
                <div className="flex justify-between text-slate-400"><span>Processing</span><span>Free</span></div>
                <div className="flex justify-between text-white font-black text-base pt-2 border-t border-white/5"><span>Total</span><span>{fmt(totalUSD, baseCurrency)}</span></div>
                {method === "wallet" && (
                  <div className="flex justify-between text-[11px] text-emerald-300/80 pt-1">
                    <span>Wallet cashback ({(WALLET_CASHBACK_PCT * 100).toFixed(0)}%)</span>
                    <span>+ {fmt(totalUSD * WALLET_CASHBACK_PCT, baseCurrency)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={pay}
                disabled={submitting}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : `Pay ${fmt(totalUSD, baseCurrency)}`}
              </button>
              <div className="mt-3 text-[11px] text-slate-500 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Secured by Oventric buyer protection
              </div>
            </div>

          </div>
        )}
      </main>

      {topUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !topUpBusy && setTopUpOpen(false)}>
          <div className="w-full max-w-md bg-[#1E1E24] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg mb-1">Fund your wallet</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add {shortfallUSD ? fmt(shortfallUSD, baseCurrency) : "credit"} or more to complete this purchase.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Amount ({baseCurrency})</label>
            <input
              type="number"
              min={1}
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-4"
            />
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Fund via</label>
            <div className="space-y-2 mb-5">
              {methodsForCountry(country).filter((m) => m.id !== "wallet").map((m) => {
                const Icon = m.Icon;
                const active = topUpMethod === m.id;
                return (
                  <button key={m.id} onClick={() => setTopUpMethod(m.id)}
                    className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 ${active ? "bg-emerald-500/10 border-emerald-500/50" : "bg-[#121214] border-white/10"}`}>
                    <Icon className={`w-4 h-4 ${active ? "text-emerald-300" : "text-slate-400"}`} />
                    <span className="text-sm text-white">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTopUpOpen(false)} disabled={topUpBusy} className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold">Cancel</button>
              <button onClick={runTopUp} disabled={topUpBusy} className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black inline-flex items-center justify-center gap-2">
                {topUpBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Charging…</> : "Fund Wallet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
