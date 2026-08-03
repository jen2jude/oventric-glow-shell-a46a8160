import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Store, MessagesSquare, ShoppingCart, Sparkles, ArrowRight, Lock } from "lucide-react";
import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import { safeFormatDisplayPrice } from "@/lib/fx-display";
import type { Currency } from "@/lib/onboarding/OnboardingContext";

/* ------------------------------------------------------------------ */
/* Trade securely banner                                               */
/* ------------------------------------------------------------------ */

const PILLARS = [
  { Icon: Lock, title: "Dual Security", body: "Escrow for buyers and seller protection." },
  { Icon: Store, title: "Vetted Community", body: "Monitored trades and verified sellers." },
  { Icon: MessagesSquare, title: "Trusted Support", body: "24/7 assistance across 54 countries." },
];

export function TradeSecurelyBanner({ onLearnMore }: { onLearnMore: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-8 pt-20">
      <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(110deg,#6d7cf0_0%,#8b7bf0_45%,#c58ce8_100%)] p-10 pr-[360px]">
        <h2 className="text-4xl font-black tracking-tight text-white">Trade Securely with OventricProtect</h2>
        <p className="mt-3 max-w-xl text-base text-white/85">
          Skip the scams and trade safely. We verify sellers and guarantee every purchase.
        </p>
        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-8">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <p.Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
              <div className="mt-3 text-lg font-black text-white">{p.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-white/85">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Shield art */}
        <div className="pointer-events-none absolute right-16 top-1/2 hidden -translate-y-1/2 lg:block">
          <div className="relative grid h-44 w-44 place-items-center">
            <span className="absolute inset-0 animate-pulse rounded-full bg-white/20 blur-2xl" />
            <ShieldCheck className="relative h-32 w-32 text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.25)]" strokeWidth={1.5} />
          </div>
        </div>

        <button
          type="button"
          onClick={onLearnMore}
          className="absolute bottom-9 right-10 inline-flex h-11 items-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          Learn More <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scrollable product rails                                            */
/* ------------------------------------------------------------------ */

function isAiCategory(p: ProductDTO) {
  const s = `${p.category ?? ""} ${p.subcategory ?? ""}`.toLowerCase();
  return s.includes("ai") && /\bai\b|artificial|prompt|gpt|machine learning/.test(s);
}

function ProductCard({ p, currency }: { p: ProductDTO; currency: Currency }) {
  const cover = p.coverUrl ?? p.imageUrls[0] ?? null;
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      search={{ qty: 1 }}
      className="group block w-[240px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-2 hover:border-emerald-300 hover:shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)]"
    >
      <div className="h-40 w-full overflow-hidden bg-slate-100">
        {cover ? (
          <img
            src={cover}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-slate-400">
            <ShoppingCart className="h-7 w-7" />
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="truncate text-[10px] font-bold uppercase tracking-widest text-emerald-600">
          {p.category}
          {p.subcategory ? ` · ${p.subcategory}` : ""}
        </div>
        <div className="mt-1 line-clamp-2 h-[36px] text-sm font-semibold leading-[18px] text-slate-900">{p.name}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-black text-slate-900">
            {safeFormatDisplayPrice(
              {
                price_usd: p.priceUSD,
                original_currency: p.originalCurrency,
                original_amount: p.originalAmount,
                fx_snapshot: p.fxSnapshot,
              },
              currency,
            )}
          </span>
          <span className="truncate text-[11px] text-slate-400">by {p.vendor}</span>
        </div>
      </div>
    </Link>
  );
}

function Rail({
  title,
  subtitle,
  items,
  currency,
}: {
  title: string;
  subtitle: string;
  items: ProductDTO[];
  currency: Currency;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="scrollbar-none mt-5 flex snap-x gap-5 overflow-x-auto pb-4">
        {items.map((p) => (
          <div key={p.id} className="snap-start">
            <ProductCard p={p} currency={currency} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductRails({ currency }: { currency: Currency }) {
  const load = useServerFn(listProducts);
  const [rows, setRows] = useState<ProductDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r) => {
        if (!cancelled) setRows(r ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [load]);

  const { ai, others } = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const aiRows = active.filter(isAiCategory).slice(0, 12);
    const aiIds = new Set(aiRows.map((r) => r.id));
    return { ai: aiRows, others: active.filter((r) => !aiIds.has(r.id)).slice(0, 12) };
  }, [rows]);

  if (ai.length === 0 && others.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1200px] space-y-12 px-8 pt-16">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.6} /> Trending on the marketplace
      </div>
      <Rail title="AI tools & assets" subtitle="Prompt packs, models and AI-powered products" items={ai} currency={currency} />
      <Rail title="More from the marketplace" subtitle="Fresh listings across every other category" items={others} currency={currency} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Secured payments                                                    */
/* ------------------------------------------------------------------ */

const METHODS: Array<{ name: string; className: string; label: string }> = [
  { name: "Visa", className: "text-[#1A1F71]", label: "VISA" },
  { name: "Mastercard", className: "text-[#EB001B]", label: "mastercard" },
  { name: "Verve", className: "text-[#00425F]", label: "verve" },
  { name: "Paystack", className: "text-[#011B33]", label: "paystack" },
  { name: "Flutterwave", className: "text-[#F5A623]", label: "flutterwave" },
  { name: "MiniPay", className: "text-[#00D26B]", label: "MiniPay" },
  { name: "MTN MoMo", className: "text-[#FFCC00]", label: "MTN MoMo" },
  { name: "Bank transfer", className: "text-slate-700", label: "Bank Transfer" },
];

export function SecuredPayments() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-8 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          <Lock className="h-3.5 w-3.5" strokeWidth={2.6} /> Secured payments
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Pay your way, protected end to end</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
          Every checkout is encrypted and held in escrow until delivery is confirmed. Pay with cards, mobile money or
          your Oventric wallet.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          {METHODS.map((m) => (
            <div
              key={m.name}
              title={m.name}
              className="flex h-14 min-w-[132px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.35)]"
            >
              <span className={`text-base font-black tracking-tight ${m.className}`}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
