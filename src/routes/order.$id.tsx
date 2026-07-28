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
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

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
    <div className="min-h-screen bg-[#121214] text-slate-200 overflow-x-hidden">
      <Header onOpenMessages={() => {}} />
      <main
        className="max-w-2xl mx-auto w-full px-4 py-6 pb-24"
        style={{
          transform: entered ? "translateX(0)" : "translateX(100%)",
          transition: "transform 260ms ease-out",
          willChange: "transform",
        }}
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

        {err && (
          <div className="bg-[#1E1E24] border border-red-500/40 rounded-lg p-4 text-sm text-red-300">{err}</div>
        )}
        {!order && !err && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your order…
          </div>
        )}

        {order && (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-300" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Thank you for your purchase</h1>
              <p className="text-xs text-slate-400">A receipt has been sent to your email.</p>
            </div>

            <div className="bg-[#1E1E24] border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">{order.category}</div>
                  <div className="text-white font-bold text-base truncate">{order.productName}</div>
                  <div className="text-xs text-slate-500 truncate">by {order.vendor} · Qty {order.quantity}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white font-bold">{fmt(displayAmount, baseCurrency)}</div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase">{order.paymentMethod.replace("_", " ")}</div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between"><span>Order ID</span><span className="font-mono text-slate-300">{order.id.slice(0, 8)}…</span></div>
                <div className="flex justify-between"><span>Status</span><span className="text-emerald-300 font-semibold uppercase">{order.status}</span></div>
                <div className="flex justify-between"><span>Placed</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
              </div>
            </div>

            {order.requiresManualDelivery ? (
              <div className="bg-[#1E1E24] border border-amber-500/40 rounded-lg p-4">
                <h2 className="text-white font-bold text-base mb-1">Manual delivery</h2>
                <p className="text-xs text-slate-400 mb-3">
                  Payment received and held in escrow. The seller will deliver this asset to you. Expect contact within 24 hours.
                </p>
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-[11px] text-amber-100 leading-relaxed mb-3">
                  <strong className="text-amber-200">Keep the delivery on Oventric.</strong> Ask the seller to send the file, link, or setup instructions through your inbox here so we can protect both sides. Once you have the goods, tap <em>Confirm receipt</em> from your Dashboard → Digital purchases to release payment. <span className="text-amber-300 font-semibold">Do not accept off-platform deals</span> — we can't refund or mediate anything that happens outside Oventric.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#121214] border border-white/10 rounded-md px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">Delivery email</div>
                    <div className="text-white font-mono truncate">{order.deliveryEmail ?? "—"}</div>
                  </div>
                  <div className="bg-[#121214] border border-white/10 rounded-md px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">WhatsApp</div>
                    <div className="text-white font-mono truncate">{order.deliveryWhatsapp ?? "—"}</div>
                  </div>
                </div>
              </div>

            ) : (
              <div className="bg-[#1E1E24] border border-emerald-500/40 rounded-lg p-4">
                <h2 className="text-white font-bold text-base mb-1">Your download</h2>
                <p className="text-xs text-slate-400 mb-3">
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-emerald-500 text-black font-bold text-sm"
                  >
                    {downloadUrl ? <><Download className="w-4 h-4" /> Download now</> : <><ExternalLink className="w-4 h-4" /> Open delivery link</>}
                  </a>
                ) : (
                  <div className="text-xs text-slate-500 inline-flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Delivery instructions sent to your email.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
