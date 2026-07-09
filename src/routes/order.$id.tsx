import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, ExternalLink, Loader2, ArrowLeft, Mail } from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { getOrderWithDownload, FX_FROM_USD, type OrderDTO } from "@/lib/marketplace.functions";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", GHS: "₵" };
function fmt(v: number, c: Currency) {
  return `${CURRENCY_SYMBOL[c]}${c === "USD" ? v.toFixed(2) : Math.round(v).toLocaleString()}`;
}

export const Route = createFileRoute("/order/$id")({
  ssr: false,
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const load = useServerFn(getOrderWithDownload);
  const { baseCurrency } = useOnboarding();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load({ data: { orderId: id } })
      .then((r) => {
        if (cancelled) return;
        setOrder(r.order);
        setDownloadUrl(r.downloadUrl);
      })
      .catch((e: Error) => { if (!cancelled) setErr(e.message || "Order not found"); });
    return () => { cancelled = true; };
  }, [id, load]);

  const displayAmount = order ? order.displayTotal * (FX_FROM_USD[baseCurrency] / FX_FROM_USD[order.displayCurrency]) : 0;
  const href = downloadUrl ?? order?.externalUrl ?? null;

  return (
    <div className="min-h-screen bg-[#121214] text-slate-200">
      <Header onOpenMessages={() => {}} />
      <main className="max-w-3xl mx-auto w-full px-4 py-6 pb-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

        {err && (
          <div className="bg-[#1E1E24] border border-red-500/40 rounded-xl p-6 text-sm text-red-300">{err}</div>
        )}
        {!order && !err && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your order…
          </div>
        )}

        {order && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Thank you for your purchase</h1>
              <p className="text-sm text-slate-400">A receipt has been sent to your email.</p>
            </div>

            <div className="bg-[#1E1E24] border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">{order.category}</div>
                  <div className="text-white font-black text-lg">{order.productName}</div>
                  <div className="text-xs text-slate-500">by {order.vendor} · Qty {order.quantity}</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-black text-xl">{fmt(displayAmount, baseCurrency)}</div>
                  <div className="text-[11px] text-slate-500 font-mono uppercase">{order.paymentMethod.replace("_", " ")}</div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between"><span>Order ID</span><span className="font-mono text-slate-300">{order.id.slice(0, 8)}…</span></div>
                <div className="flex justify-between"><span>Status</span><span className="text-emerald-300 font-semibold uppercase">{order.status}</span></div>
                <div className="flex justify-between"><span>Placed</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
              </div>
            </div>

            <div className="bg-[#1E1E24] border border-emerald-500/40 rounded-2xl p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.5)]">
              <h2 className="text-white font-black text-lg mb-1">Your download</h2>
              <p className="text-xs text-slate-400 mb-4">
                {downloadUrl
                  ? "Signed download link valid for 60 minutes."
                  : order.externalUrl
                  ? "Delivered from the seller's hosted link."
                  : "The seller hasn't attached a downloadable file for this listing."}
              </p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors"
                >
                  {downloadUrl ? <><Download className="w-4 h-4" /> Download now</> : <><ExternalLink className="w-4 h-4" /> Open delivery link</>}
                </a>
              ) : (
                <div className="text-xs text-slate-500 inline-flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Delivery instructions sent to your email.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
