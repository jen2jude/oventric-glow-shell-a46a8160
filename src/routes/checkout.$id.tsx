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
  ChevronDown,
  Building2,
  Check,
  Headphones,
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

import { initPayment, getPaymentOptions } from "@/lib/payments.functions";
import { MiniPayPanel } from "@/components/oventric/MiniPayPanel";
import { usdRate, convertViaSnapshot, formatMoney } from "@/lib/fx-display";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { useIsAppShell } from "@/hooks/use-launch-context";

// Checkout works in USD canonical (the wallet is USD-native). Display
// conversion for the viewer uses the LEGACY fallback rates; the true locked
// price is shown on the product/listing card via computeDisplayPrice.
// Live USD-base rate for any supported currency.
const rateFor = (cur: Currency) => usdRate(cur);

function fmt(usd: number, cur: Currency) {
  return formatMoney(usd * rateFor(cur), cur);
}

/** Format a USD amount using the product's LOCKED FX snapshot when available. */
function fmtSnap(usd: number, cur: Currency, snap: ProductDTO["fxSnapshot"] | null | undefined) {
  const s = snap && snap.rates ? { base: "USD" as const, rates: snap.rates } : null;
  const converted = convertViaSnapshot(usd, "USD", cur, s);
  const v = converted > 0 || usd === 0 ? converted : usd * rateFor(cur);
  return formatMoney(v, cur);
}

/** Format an amount that's ALREADY in the given currency (no USD conversion). */
function fmtLocal(amount: number, cur: Currency) {
  return formatMoney(amount, cur);
}

/**
 * Preferred display: when the viewer's currency matches the product's
 * ORIGINAL listing currency, show the seller's exact locked amount — no USD
 * round-trip, no snapshot drift. Otherwise fall back to snapshot conversion.
 */
function fmtPrice(
  usdAmount: number,
  viewer: Currency,
  product: ProductDTO | null,
  originalLocalAmount: number,
) {
  if (product && viewer === (product.originalCurrency as Currency)) {
    return fmtLocal(originalLocalAmount, viewer);
  }
  return fmtSnap(usdAmount, viewer, product?.fxSnapshot ?? null);
}

/** Country-driven payment method availability. Wallet is greyed out on marketplace checkout — buyers pay directly. */
function methodsForCountry(
  country: string | null,
): Array<{
  id: PaymentMethod;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  hint: string;
  disabled?: boolean;
}> {
  const wallet = {
    id: "wallet" as PaymentMethod,
    label: "Oventric Wallet",
    Icon: WalletIcon,
    hint: "Direct checkout preferred — fund wallet for bounties & ads only",
    disabled: true,
  };
  if (country === "NG") {
    return [
      { id: "card", label: "Debit/Credit Card", Icon: CreditCard, hint: "Verve, Mastercard, Visa" },
      wallet,
    ];
  }
  if (country === "GH") {
    return [
      {
        id: "mobile_money",
        label: "Mobile Money",
        Icon: Smartphone,
        hint: "MTN · Vodafone · AirtelTigo",
      },
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
  validateSearch: (s: Record<string, unknown>) => ({
    qty: Math.max(1, Math.min(20, Number(s?.qty ?? 1) || 1)),
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id } = Route.useParams();
  const { qty } = Route.useSearch();
  const navigate = useNavigate();
  const { baseCurrency, country } = useOnboarding();
  const isAppShell = useIsAppShell();

  const loadProduct = useServerFn(getProduct);
  const submitOrder = useServerFn(createOrder);
  const initCharge = useServerFn(initPayment);

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
  const [minipay, setMinipay] = useState<{ available: boolean }>({ available: false });
  const [minipayOpen, setMinipayOpen] = useState(false);
  // Gateway picker shown under "Debit/Credit Card".
  const [cardOpen, setCardOpen] = useState(true);
  const [gateway, setGateway] = useState<"flutterwave" | "paystack" | "minipay">("flutterwave");
  const [recommended, setRecommended] = useState<"flutterwave" | "paystack">("flutterwave");
  const loadOptions = useServerFn(getPaymentOptions);

  useEffect(() => {
    let cancelled = false;
    loadOptions({ data: { currency: baseCurrency, purpose: "order" } })
      .then((o) => {
        if (cancelled) return;
        setMinipay({ available: o.minipay.available });
        setRecommended(o.provider);
        setGateway(o.provider);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadOptions, baseCurrency]);

  const methods = useMemo(() => methodsForCountry(country), [country]);
  const subtotalUSD = useMemo(() => (product ? product.priceUSD * qty : 0), [product, qty]);
  // When viewing in the product's ORIGINAL currency, prefer the seller's exact
  // locked amount so the checkout total matches the listing card 1:1.
  const subtotalLocal = useMemo(() => (product ? product.originalAmount * qty : 0), [product, qty]);
  // Cashback (spend-only) can now be applied on ANY payment method.
  const cashbackApplyUSD = useMemo(() => {
    if (!useCashback) return 0;
    return Math.min(cashbackUSD, Math.max(0, subtotalUSD));
  }, [useCashback, cashbackUSD, subtotalUSD]);
  const totalUSD = Number((subtotalUSD - cashbackApplyUSD).toFixed(2));
  const cashbackApplyLocal =
    subtotalUSD > 0 ? Number(((cashbackApplyUSD / subtotalUSD) * subtotalLocal).toFixed(2)) : 0;
  const totalLocalExact = Number((subtotalLocal - cashbackApplyLocal).toFixed(2));
  // Cashback earn is ALWAYS 2% of the full gross sale price — regardless of
  // whether the buyer applied any cashback on this order.
  const cashbackEarnUSD = Number((subtotalUSD * WALLET_CASHBACK_PCT).toFixed(2));

  useEffect(() => {
    let cancelled = false;
    loadProduct({ data: { id } })
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadErr(e.message || "Failed to load");
      });
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, [shortfallUSD, topUpBusy, baseCurrency]);

  // Prefill delivery email from the current auth user.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user?.email) setDeliveryEmail((prev) => prev || data.user!.email!);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDigital = product?.kind === "digital";
  const needsDelivery = Boolean(isDigital);
  const deliveryValid = !needsDelivery || /^\S+@\S+\.\S+$/.test(deliveryEmail.trim());

  // `balanceUSD` state actually holds the buyer's balance in their HOME
  // currency (see the fetcher above). Compare it against the total in that
  // same currency so what the user sees on the button matches what the wallet
  // will be debited.
  const totalLocal =
    product && baseCurrency === (product.originalCurrency as Currency)
      ? totalLocalExact
      : Number((totalUSD * rateFor(baseCurrency)).toFixed(2));

  const insufficient = method === "wallet" && balanceUSD !== null && balanceUSD < totalLocal;

  const pay = async () => {
    if (!product || submitting) return;
    if (needsDelivery && !deliveryValid) {
      toast.error("Add your delivery details", {
        description: "We need a valid email address to deliver your purchase.",
      });
      return;
    }
    // MiniPay is a manual (proof-of-transfer) flow — open its panel instead.
    if (method !== "wallet" && gateway === "minipay") {
      setMinipayOpen(true);
      return;
    }
    setSubmitting(true);
    setShortfallUSD(null);
    try {
      // Non-wallet methods: initialize the selected gateway and redirect to its secure checkout.
      if (method !== "wallet") {
        const channel: "card" | "bank_transfer" | "mobile_money" | undefined =
          method === "card"
            ? "card"
            : method === "bank_transfer"
              ? "bank_transfer"
              : method === "mobile_money"
                ? "mobile_money"
                : undefined;
        const init = await initCharge({
          data: {
            purpose: "order",
            productId: product.id,
            quantity: qty,
            displayCurrency: baseCurrency,
            couponCode: null,
            deliveryEmail: needsDelivery ? deliveryEmail.trim() : null,
            deliveryWhatsapp: null,
            applyCashbackUSD: cashbackApplyUSD,
            channel,
            provider: gateway === "minipay" ? undefined : gateway,
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
          deliveryWhatsapp: null,
          applyCashbackUSD: cashbackApplyUSD,
        },
      });

      const shortDisplay = res.walletShortfallDisplay;
      const shortUSD = res.walletShortfallUSD;
      if ((shortDisplay != null && shortDisplay > 0) || (shortUSD != null && shortUSD > 0)) {
        const shortLocal =
          shortDisplay != null
            ? shortDisplay
            : Number(((shortUSD ?? 0) * rateFor(baseCurrency)).toFixed(2));
        setShortfallUSD(shortUSD ?? Number((shortLocal / rateFor(baseCurrency)).toFixed(2)));
        setTopUpOpen(true);
        setTopUpAmount(String(Math.ceil(shortLocal)));
        toast.error("Wallet balance too low", {
          description: `Top up ${fmtLocal(shortLocal, baseCurrency)} to continue.`,
        });
        return;
      }
      if (res.cashbackUSD && res.cashbackUSD > 0) {
        toast.success("Payment successful", {
          description: `${fmt(res.cashbackUSD, baseCurrency)} cashback credited to your wallet.`,
        });
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
    if (!(amt > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setTopUpBusy(true);
    try {
      const channel =
        topUpMethod === "card"
          ? "card"
          : topUpMethod === "bank_transfer"
            ? "bank_transfer"
            : topUpMethod === "mobile_money"
              ? "mobile_money"
              : "card";
      const init = await initCharge({
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
    <div
      className={`min-h-screen overflow-x-hidden ${
        isAppShell
          ? "bg-[#0A0A0B] text-slate-200"
          : "page-light bg-[#FFFFFF] text-slate-900"
      }`}
    >
      <Header onOpenMessages={() => {}} light={!isAppShell} desktopNav={!isAppShell} />
      <main
        className={`max-w-4xl mx-auto w-full min-w-0 ${
          isAppShell ? "px-0 py-0 pb-32" : "px-4 py-12 pb-24"
        }`}
      >
        <Link
          to="/product/$id"
          params={{ id }}
          search={{ qty }}
          className={`inline-flex items-center gap-2 text-sm transition-all ${
            isAppShell
              ? "absolute top-4 left-4 z-20 w-10 h-10 items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white"
              : "text-slate-600 hover:text-slate-900 bg-white shadow-sm border border-slate-200 rounded-lg px-3 py-2 mb-6"
          }`}
        >
          {isAppShell ? (
            <ArrowLeft className="w-6 h-6" />
          ) : (
            <>
              <ArrowLeft className="w-4 h-4" /> Back
            </>
          )}
        </Link>

        {/* No H1 needed as Header provides context */}

        {loadErr && (
          <div className={`${isAppShell ? "bg-[#16161A] border-white/5 mx-4" : "bg-white shadow-sm border-red-200"} border rounded-xl p-6 text-sm text-red-500`}>
            {loadErr}
          </div>
        )}

        {!product && !loadErr && (
          <div className={`flex items-center gap-2 text-sm ${isAppShell ? "text-slate-500 px-4" : "text-slate-500"}`}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
          </div>
        )}

        {product && (
          <div
            className={`grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0 ${isAppShell ? "p-0" : ""}`}
          >
            {/* Payment methods */}
            <div className={`lg:col-span-2 space-y-3 min-w-0 ${isAppShell ? "px-4 pt-16" : ""}`}>
              {isAppShell && (
                <div className="flex items-center gap-4 mb-6">
                  {product.coverUrl && (
                    <ResponsiveImage
                      src={product.coverUrl}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-xl border border-white/5"
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-black text-white">{product.name}</h1>
                    <div className="text-xs text-slate-500">Checkout · Qty {qty}</div>
                  </div>
                </div>
              )}
              <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                Select Payment Method
              </h2>
              {methods.map((m) => {
                const active = method === m.id;
                const Icon = m.Icon;
                const walletTag = m.id === "wallet" && balanceUSD !== null;
                const hasGateways =
                  m.id === "card" || m.id === "mobile_money" || m.id === "bank_transfer";
                const expanded = hasGateways && active && cardOpen;
                const gateways: Array<{
                  id: "flutterwave" | "paystack" | "minipay";
                  label: string;
                  hint: string;
                  Icon: React.ComponentType<{ className?: string }>;
                }> = [
                  {
                    id: "flutterwave",
                    label: "Flutterwave",
                    hint: "Cards, bank transfer & mobile money",
                    Icon: CreditCard,
                  },
                  {
                    id: "paystack",
                    label: "Paystack",
                    hint: "Cards, bank transfer & USSD",
                    Icon: Building2,
                  },
                  ...(minipay.available
                    ? [
                        {
                          id: "minipay" as const,
                          label: "MiniPay",
                          hint: "Send manually, upload receipt · verified by our team",
                          Icon: Smartphone,
                        },
                      ]
                    : []),
                ];
                return (
                  <div key={m.id}>
                    <button
                      onClick={() => {
                        if (m.disabled) return;
                        setMethod(m.id);
                        if (hasGateways) setCardOpen(active ? !cardOpen : true);
                      }}
                      disabled={m.disabled}
                      aria-disabled={m.disabled}
                      aria-expanded={hasGateways ? expanded : undefined}
                      title={
                        m.disabled
                          ? "Wallet is reserved for bounties & ads. Pay directly instead."
                          : undefined
                      }
                      className={`w-full text-left rounded-xl border p-4 flex items-center gap-4 transition-all ${
                        m.disabled
                          ? isAppShell
                            ? "bg-[#16161A]/50 border-white/5 opacity-40 cursor-not-allowed"
                            : "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                          : active
                            ? "bg-emerald-500/10 border-emerald-500/50"
                            : isAppShell
                              ? "bg-[#16161A] border-white/5 hover:border-white/10"
                              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <span
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${active && !m.disabled ? "bg-emerald-500/20" : isAppShell ? "bg-white/5" : "bg-slate-100"}`}
                      >
                        <Icon
                          className={`w-5 h-5 ${active && !m.disabled ? (isAppShell ? "text-emerald-300" : "text-emerald-600") : isAppShell ? "text-slate-300" : "text-slate-500"}`}
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-white md:text-slate-900 font-semibold">
                          {m.label}
                          {m.disabled && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:text-slate-500">
                              Unavailable here
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-slate-500 md:text-slate-500">
                          {hasGateways && active
                            ? `via ${gateways.find((g) => g.id === gateway)?.label ?? m.hint}`
                            : m.hint}
                        </span>
                      </span>
                      {walletTag && (
                        <span className="text-[11px] font-mono text-slate-400 md:text-slate-500">
                          {fmtLocal(balanceUSD ?? 0, baseCurrency)}
                        </span>
                      )}
                      {hasGateways && !m.disabled && (
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    {expanded && (
                      <div className="mt-2 ml-4 pl-4 border-l border-white/10 md:border-slate-200 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 md:text-slate-500">
                          Choose payment provider
                        </div>
                        {gateways.map((g) => {
                          const on = gateway === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => setGateway(g.id)}
                              className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-all ${
                                on
                                  ? "bg-emerald-500/10 border-emerald-500/50"
                                  : isAppShell
                                    ? "bg-[#0A0A0B] border-white/5 hover:border-white/10"
                                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                              }`}
                            >
                              <g.Icon
                                className={`w-4 h-4 shrink-0 ${on ? "text-emerald-300" : "text-slate-400"}`}
                              />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-white md:text-slate-900 font-semibold">
                                  {g.label}
                                  {g.id === recommended && (
                                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                      Recommended
                                    </span>
                                  )}
                                </span>
                                <span className="block text-[11px] text-slate-500 md:text-slate-500">
                                  {g.hint}
                                </span>
                              </span>
                              {on && <Check className="w-4 h-4 text-emerald-300 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {insufficient && (
                <div
                  className={`mt-2 flex items-start gap-3 text-xs rounded-lg p-3 ${
                    isAppShell
                      ? "text-amber-300 bg-amber-500/5 border border-amber-500/20"
                      : "text-amber-300 bg-amber-500/10 border border-amber-500/40"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div>
                      Wallet has {fmtLocal(balanceUSD ?? 0, baseCurrency)} — you need{" "}
                      {fmtLocal(totalLocal, baseCurrency)}.
                    </div>
                    <button
                      onClick={() => {
                        const shortLocal = Math.max(0, totalLocal - (balanceUSD ?? 0));
                        setShortfallUSD(Number((shortLocal / rateFor(baseCurrency)).toFixed(2)));
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
                <div
                  className={`mt-2 rounded-xl border p-4 ${
                    isAppShell
                      ? "border-white/5 bg-[#16161A]"
                      : "border-slate-200 bg-white shadow-sm"
                  }`}
                >
                  <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                    Delivery details
                  </div>
                  <p className="text-[11px] text-slate-500 md:text-slate-500 mb-3">
                    {product.requiresManualDelivery
                      ? "This product requires manual deployment. After payment is verified, the seller delivers it to you in your Oventric chat."
                      : "We’ll send the receipt and download link here after payment is verified."}
                  </p>
                  <label className="block mb-2">
                    <span className={`text-xs ${isAppShell ? "text-slate-300" : "text-slate-700 font-medium"}`}>Email Address</span>
                    <input
                      type="email"
                      value={deliveryEmail}
                      onChange={(e) => setDeliveryEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60 ${
                        isAppShell
                          ? "bg-[#0A0A0B] border-white/10 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                  </label>
                  {!deliveryValid && deliveryEmail && (
                    <div className="text-[11px] text-red-300 mt-2">
                      Enter a valid email address.
                    </div>
                  )}
                  <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-100 leading-relaxed">
                    <strong className="text-emerald-200">
                      Delivery happens in your Oventric chat.
                    </strong>{" "}
                    Your payment is held in escrow and only released after you confirm receipt.
                    Never move a trade to WhatsApp or any other app — we can only refund or mediate
                    deals completed here.
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div
              className={`h-max min-w-0 ${
                isAppShell
                  ? "lg:col-span-1 space-y-4 px-4 pb-8"
                  : "bg-white shadow-sm border border-slate-200 rounded-xl p-5 lg:col-span-1"
              }`}
            >
              {!isAppShell && (
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 md:text-slate-500 mb-3">
                  Order Summary
                </h2>
              )}
              {isAppShell ? null : product.coverUrl ? (
                <ResponsiveImage
                  src={product.coverUrl}
                  alt={product.name}
                  sizes="(min-width: 1024px) 384px, 100vw"
                  className="w-full h-32 object-cover rounded-lg mb-3 border border-white/5 md:border-slate-200 bg-white/5 md:bg-slate-100"
                  loading="eager"
                  fetchPriority="high"
                />
              ) : (
                <div className="h-20 rounded-lg bg-white/5 md:bg-slate-100 mb-3" />
              )}
              {!isAppShell && (
                <>
                  <div className="text-white md:text-slate-900 font-semibold text-sm mb-1">
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-500 md:text-slate-500 mb-3">
                    by {product.vendor} · Qty {qty}
                  </div>
                </>
              )}

              {/* Cashback Wallet — spend-only. Toggle always visible; disabled when empty. */}
              <div
                className={`pt-3 mb-3 border-t ${
                  isAppShell ? "border-white/5" : "border-white/5 md:border-slate-200"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${isAppShell ? "text-slate-400" : "text-slate-600"}`}>
                  Cashback Wallet
                </div>
                <label
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border transition-all ${
                    cashbackUSD > 0
                      ? isAppShell
                        ? "bg-emerald-500/5 border-emerald-500/20 cursor-pointer"
                        : "bg-emerald-500/10 border-emerald-500/40 cursor-pointer"
                      : isAppShell
                        ? "bg-[#0A0A0B] border-white/5 opacity-50 cursor-not-allowed"
                        : "bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed"
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
                    <div className="text-xs font-semibold text-white md:text-slate-900">
                      Use Cashback
                    </div>
                    <div
                      className={`text-[11px] ${cashbackUSD > 0 ? "text-emerald-300" : "text-slate-500"}`}
                    >
                      Available: {fmt(cashbackUSD, baseCurrency)} · spend-only, not withdrawable
                    </div>
                    <div className="text-[11px] text-slate-400 md:text-slate-500 mt-0.5">
                      You earn back: + {fmt(cashbackEarnUSD, baseCurrency)} (Oventric Bonus)
                    </div>
                  </div>
                </label>
              </div>

              <div
                className={`pt-3 space-y-1 text-sm border-t ${
                  isAppShell ? "border-white/5" : "border-slate-200"
                }`}
              >
                <div className={`flex justify-between ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
                  <span>Subtotal</span>
                  <span>{fmtPrice(subtotalUSD, baseCurrency, product, subtotalLocal)}</span>
                </div>
                {cashbackApplyUSD > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Cashback applied</span>
                    <span>
                      − {fmtPrice(cashbackApplyUSD, baseCurrency, product, cashbackApplyLocal)}
                    </span>
                  </div>
                )}
                <div className={`flex justify-between ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
                  <span>Processing</span>
                  <span />
                </div>
                <div
                  className={`flex justify-between font-black text-lg pt-2 border-t ${
                    isAppShell
                      ? "text-white border-white/5"
                      : "text-slate-900 border-slate-200"
                  }`}
                >
                  <span>Total</span>
                  <span>{fmtPrice(totalUSD, baseCurrency, product, totalLocalExact)}</span>
                </div>
              </div>

              {isAppShell ? (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0B]/80 backdrop-blur-xl border-t border-white/5 p-4 flex flex-col gap-3 pb-safe">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs text-slate-400">Total to pay</span>
                    <span className="text-lg font-black text-white">
                      {fmtPrice(totalUSD, baseCurrency, product, totalLocalExact)}
                    </span>
                  </div>
                  <button
                    onClick={pay}
                    disabled={submitting || (needsDelivery && !deliveryValid)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_20px_-5px_rgba(16,185,129,0.4)]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                      </>
                    ) : method === "wallet" ? (
                      `Pay ${fmtPrice(totalUSD, baseCurrency, product, totalLocalExact)}`
                    ) : gateway === "minipay" ? (
                      `Pay with MiniPay`
                    ) : (
                      `Pay with ${gateway === "paystack" ? "Paystack" : "Flutterwave"}`
                    )}
                  </button>
                  <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1 opacity-60">
                    <ShieldCheck className="w-3 h-3 text-emerald-500/50" /> Secured by Oventric
                    escrow
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={pay}
                    disabled={submitting || (needsDelivery && !deliveryValid)}
                    className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                      </>
                    ) : method === "wallet" ? (
                      `Pay ${fmtPrice(totalUSD, baseCurrency, product, totalLocalExact)}`
                    ) : gateway === "minipay" ? (
                      `Pay with MiniPay · ${fmtPrice(totalUSD, baseCurrency, product, totalLocalExact)}`
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Pay with {gateway === "paystack" ? "Paystack" : "Flutterwave"} · {fmtPrice(totalUSD, baseCurrency, product, totalLocalExact)}
                      </span>
                    )}
                  </button>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> Secured by Oventric buyer
                      protection
                    </div>
                    <Link
                      to="/help-board"
                      className="text-[11px] font-medium text-emerald-600 hover:text-emerald-500 inline-flex items-center gap-1"
                    >
                      <Headphones className="w-3 h-3" /> Get help
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {topUpOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !topUpBusy && setTopUpOpen(false)}
        >
          <div
            className={`w-full max-w-md border rounded-2xl p-6 ${
              isAppShell ? "bg-[#16161A] border-white/5" : "bg-white shadow-sm border-slate-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white md:text-slate-900 font-black text-lg mb-1">
              Fund your wallet
            </h3>
            <p className="text-xs text-slate-400 md:text-slate-500 mb-4">
              Add {shortfallUSD ? fmt(shortfallUSD, baseCurrency) : "credit"} or more to complete
              this purchase.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 md:text-slate-500 mb-1.5">
              Amount ({baseCurrency})
            </label>
            <input
              type="number"
              min={1}
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-emerald-500/60 ${
                isAppShell ? "bg-[#0A0A0B] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 md:text-slate-500 mb-1.5">
              Fund via
            </label>
            <div className="space-y-2 mb-5">
              {methodsForCountry(country)
                .filter((m) => m.id !== "wallet")
                .map((m) => {
                  const Icon = m.Icon;
                  const active = topUpMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setTopUpMethod(m.id)}
                      className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-all ${
                        active
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : isAppShell
                            ? "bg-[#0A0A0B] border-white/5"
                            : "bg-white border-slate-200"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${active ? "text-emerald-300" : "text-slate-400"}`}
                      />
                      <span className="text-sm text-white md:text-slate-900">{m.label}</span>
                    </button>
                  );
                })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTopUpOpen(false)}
                disabled={topUpBusy}
                className="flex-1 py-2 rounded-lg bg-white/5 md:bg-slate-100 hover:bg-white/10 text-slate-200 md:text-slate-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={runTopUp}
                disabled={topUpBusy}
                className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black inline-flex items-center justify-center gap-2"
              >
                {topUpBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Charging…
                  </>
                ) : (
                  "Fund Wallet"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {minipayOpen && product && (
        <MiniPayPanel
          purpose="order"
          targetId={product.id}
          quantity={qty}
          currency={baseCurrency}
          onClose={() => setMinipayOpen(false)}
        />
      )}
    </div>
  );
}
