import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  CreditCard,
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
  WALLET_CASHBACK_PCT,
  type ProductDTO,
  type PaymentMethod,
} from "@/lib/marketplace.functions";

import { initPaystackPayment } from "@/lib/paystack.functions";
import { LEGACY_USD_RATES, convertViaSnapshot } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";

// Checkout works in USD canonical (the wallet is USD-native). Display
// conversion for the viewer uses the LEGACY fallback rates; the true locked
// price is shown on the product/listing card via computeDisplayPrice.
const FX_FROM_USD = LEGACY_USD_RATES;
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };

function fmt(usd: number, cur: Currency) {
  const v = usd * FX_FROM_USD[cur];
  return `${CURRENCY_SYMBOL[cur]}${cur === "USD" ? v.toFixed(2) : Math.round(v).toLocaleString()}`;
}

/** Format a USD amount using the product's LOCKED FX snapshot when available. */
function fmtSnap(usd: number, cur: Currency, snap: ProductDTO["fxSnapshot"] | null | undefined) {
  const s = snap && snap.rates ? { base: "USD" as const, rates: snap.rates } : null;
  const converted = convertViaSnapshot(usd, "USD", cur, s);
  const v = converted > 0 || usd === 0 ? converted : usd * FX_FROM_USD[cur];
  return `${CURRENCY_SYMBOL[cur]}${cur === "USD" ? v.toFixed(2) : Math.round(v).toLocaleString()}`;
}

/** Format an amount that's ALREADY in the given currency (no USD conversion). */
function fmtLocal(amount: number, cur: Currency) {
  return `${CURRENCY_SYMBOL[cur]}${cur === "USD" ? amount.toFixed(2) : Math.round(amount).toLocaleString()}`;
}


/** Country-driven payment method availability. Wallet is greyed out on marketplace checkout — buyers pay directly. */
function methodsForCountry(country: string | null): Array<{ id: PaymentMethod; label: string; Icon: React.ComponentType<{ className?: string }>; hint: string; disabled?: boolean }> {
  const wallet = { id: "wallet" as PaymentMethod, label: "Oventric Wallet", Icon: WalletIcon, hint: "Direct checkout preferred — fund wallet for bounties & ads only", disabled: true };
  if (country === "NG") {
    return [
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Verve, Mastercard, Visa" },
      wallet,
    ];
  }
  if (country === "GH") {
    return [
      { id: "mobile_money", label: "Mobile Money", Icon: Smartphone, hint: "MTN · Vodafone · AirtelTigo" },
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Mastercard, Visa" },
      wallet,
    ];
  }
  return [
    { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Global cards" },
    wallet,
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

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [balanceUSD, setBalanceUSD] = useState<number | null>(null);
  const [cashbackUSD, setCashbackUSD] = useState<number>(0);
  const [useCashback, setUseCashback] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [shortfallUSD, setShortfallUSD] = useState<number | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpMethod, setTopUpMethod] = useState<PaymentMethod>("card");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [deliveryWhatsapp, setDeliveryWhatsapp] = useState("");

  const methods = useMemo(() => methodsForCountry(country), [country]);
  const subtotalUSD = useMemo(() => (product ? product.priceUSD * qty : 0), [product, qty]);
  // Cashback (spend-only) can now be applied on ANY payment method.
  const cashbackApplyUSD = useMemo(() => {
    if (!useCashback) return 0;
    return Math.min(cashbackUSD, Math.max(0, subtotalUSD));
  }, [useCashback, cashbackUSD, subtotalUSD]);
  const totalUSD = Number((subtotalUSD - cashbackApplyUSD).toFixed(2));
  // Cashback earn is ALWAYS 2% of the full gross sale price — regardless of
  // whether the buyer applied any cashback on this order.
  const cashbackEarnUSD = Number((subtotalUSD * WALLET_CASHBACK_PCT).toFixed(2));



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
      // Read balance in the buyer's home currency (that's where Paystack top-ups
      // credit and that's what the wallet will actually be debited in).
      const { data: localRow } = await supabase
        .from("wallets")
        .select("available_balance")
        .eq("user_id", uid)
        .eq("currency", baseCurrency)
        .maybeSingle();
      // Cashback pot is USD-canonical.
      const { data: cbRow } = await supabase
        .from("wallets")
        .select("accumulated_cashback")
        .eq("user_id", uid)
        .eq("currency", "USD")
        .maybeSingle();
      if (!cancelled) {
        setBalanceUSD(Number(localRow?.available_balance ?? 0));
        setCashbackUSD(Number(cbRow?.accumulated_cashback ?? 0));
      }
    };
    refresh();
    return () => { cancelled = true; };
  }, [shortfallUSD, topUpBusy, baseCurrency]);

  // Prefill delivery email from the current auth user.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user?.email) setDeliveryEmail((prev) => prev || data.user!.email!);
    });
    return () => { cancelled = true; };
  }, []);

  const isDigital = product?.kind === "digital";
  const needsDelivery = Boolean(isDigital);
  const deliveryValid = !needsDelivery || (
    /^\S+@\S+\.\S+$/.test(deliveryEmail.trim()) && deliveryWhatsapp.replace(/\D/g, "").length >= 6
  );

  // `balanceUSD` state actually holds the buyer's balance in their HOME
  // currency (see the fetcher above). Compare it against the total in that
  // same currency so what the user sees on the button matches what the wallet
  // will be debited.
  const totalLocal = Number((totalUSD * FX_FROM_USD[baseCurrency]).toFixed(2));
  const insufficient = method === "wallet" && balanceUSD !== null && balanceUSD < totalLocal;

  const pay = async () => {
    if (!product || submitting) return;
    if (needsDelivery && !deliveryValid) {
      toast.error("Add your delivery details", { description: "We need a valid email and WhatsApp number to deliver your purchase." });
      return;
    }
    setSubmitting(true);
    setShortfallUSD(null);
    try {
      const digits = deliveryWhatsapp.replace(/\D/g, "");
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
            couponCode: null,
            deliveryEmail: needsDelivery ? deliveryEmail.trim() : null,
            deliveryWhatsapp: needsDelivery ? digits : null,
            applyCashbackUSD: cashbackApplyUSD,
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
          couponCode: null,
          deliveryEmail: needsDelivery ? deliveryEmail.trim() : null,
          deliveryWhatsapp: needsDelivery ? digits : null,
          applyCashbackUSD: cashbackApplyUSD,
        },
      });

      const shortDisplay = res.walletShortfallDisplay;
      const shortUSD = res.walletShortfallUSD;
      if ((shortDisplay != null && shortDisplay > 0) || (shortUSD != null && shortUSD > 0)) {
        const shortLocal = shortDisplay != null
          ? shortDisplay
          : Number(((shortUSD ?? 0) * FX_FROM_USD[baseCurrency]).toFixed(2));
        setShortfallUSD(shortUSD ?? Number((shortLocal / FX_FROM_USD[baseCurrency]).toFixed(2)));
        setTopUpOpen(true);
        setTopUpAmount(String(Math.ceil(shortLocal)));
        toast.error("Wallet balance too low", { description: `Top up ${fmtLocal(shortLocal, baseCurrency)} to continue.` });
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
    <div className="min-h-screen bg-[#121214] text-slate-200 overflow-x-hidden">
      <Header onOpenMessages={() => {}} />
      <main className="max-w-4xl mx-auto w-full px-4 py-6 pb-24 min-w-0">

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
            {/* Payment methods */}
            <div className="lg:col-span-2 space-y-3 min-w-0">

              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Payment Method</h2>
              {methods.map((m) => {
                const active = method === m.id;
                const Icon = m.Icon;
                const walletTag = m.id === "wallet" && balanceUSD !== null;
                return (
                  <button
                    key={m.id}
                    onClick={() => { if (!m.disabled) setMethod(m.id); }}
                    disabled={m.disabled}
                    aria-disabled={m.disabled}
                    title={m.disabled ? "Wallet is reserved for bounties & ads. Pay directly instead." : undefined}
                    className={`w-full text-left rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                      m.disabled
                        ? "bg-[#141418] border-white/5 opacity-50 cursor-not-allowed"
                        : active
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : "bg-[#1E1E24] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${active && !m.disabled ? "bg-emerald-500/20" : "bg-white/5"}`}>
                      <Icon className={`w-5 h-5 ${active && !m.disabled ? "text-emerald-300" : "text-slate-300"}`} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white font-semibold">
                        {m.label}
                        {m.disabled && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unavailable here</span>}
                      </span>
                      <span className="block text-xs text-slate-500">{m.hint}</span>
                    </span>
                    {walletTag && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {fmtLocal(balanceUSD ?? 0, baseCurrency)}
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
                      Wallet has {fmtLocal(balanceUSD ?? 0, baseCurrency)} — you need {fmtLocal(totalLocal, baseCurrency)}.
                    </div>
                    <button
                      onClick={() => {
                        const shortLocal = Math.max(0, totalLocal - (balanceUSD ?? 0));
                        setShortfallUSD(Number((shortLocal / FX_FROM_USD[baseCurrency]).toFixed(2)));
                        setTopUpAmount(String(Math.ceil(shortLocal)));
                        setTopUpOpen(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-black"
                    >
                      Fund Wallet
                    </button>
                  </div>
                </div>
              )}

              {needsDelivery && (
                <div className="mt-2 rounded-xl border border-white/10 bg-[#1E1E24] p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Delivery details</div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {product.requiresManualDelivery
                      ? "This product requires manual deployment. After payment is verified, the seller will use these details to deliver your purchase."
                      : "We’ll send the receipt and download link here after payment is verified."}
                  </p>
                  <label className="block mb-2">
                    <span className="text-xs text-slate-300">Email</span>
                    <input
                      type="email"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">WhatsApp number</span>
                    <input
                      inputMode="tel"
                      value={deliveryWhatsapp}
                      onChange={(e) => setDeliveryWhatsapp(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="mt-1 w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
                    />
                  </label>
                  {!deliveryValid && (deliveryEmail || deliveryWhatsapp) && (
                    <div className="text-[11px] text-red-300 mt-2">Enter a valid email and phone number with at least 6 digits.</div>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-5 h-max min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Order Summary</h2>
              {product.coverUrl ? (
                <ResponsiveImage
                  src={product.coverUrl}
                  alt={product.name}
                  sizes="(min-width: 1024px) 384px, 100vw"
                  className="w-full h-32 object-cover rounded-lg mb-3 border border-white/5 bg-white/5"
                  loading="eager"
                  fetchPriority="high"
                />

              ) : (
                <div className="h-20 rounded-lg bg-white/5 mb-3" />
              )}
              <div className="text-white font-semibold text-sm mb-1">{product.name}</div>
              <div className="text-xs text-slate-500 mb-3">by {product.vendor} · Qty {qty}</div>

              {/* Cashback Wallet — spend-only. Toggle always visible; disabled when empty. */}
              <div className="border-t border-white/5 pt-3 mb-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Cashback Wallet</div>
                <label
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                    cashbackUSD > 0
                      ? "bg-emerald-500/10 border-emerald-500/40 cursor-pointer"
                      : "bg-[#121214] border-white/10 opacity-70 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={useCashback}
                    disabled={cashbackUSD <= 0}
                    onChange={(e) => setUseCashback(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">Use Cashback</div>
                    <div className={`text-[11px] ${cashbackUSD > 0 ? "text-emerald-300" : "text-slate-500"}`}>
                      Available: {fmt(cashbackUSD, baseCurrency)} · spend-only, not withdrawable
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      You earn back: + {fmt(cashbackEarnUSD, baseCurrency)} (Oventric Bonus)
                    </div>
                  </div>
                </label>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmt(subtotalUSD, baseCurrency)}</span></div>
                {cashbackApplyUSD > 0 && (
                  <div className="flex justify-between text-emerald-300"><span>Cashback applied</span><span>− {fmt(cashbackApplyUSD, baseCurrency)}</span></div>
                )}
                <div className="flex justify-between text-slate-400"><span>Processing</span><span>Free</span></div>
                <div className="flex justify-between text-white font-black text-base pt-2 border-t border-white/5"><span>Total</span><span>{fmt(totalUSD, baseCurrency)}</span></div>
              </div>

              <button
                onClick={pay}
                disabled={submitting || (needsDelivery && !deliveryValid)}
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
