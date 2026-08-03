import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Store, MessagesSquare, Sparkles, ArrowRight, Lock, Package } from "lucide-react";
import { listProducts, type ProductDTO } from "@/lib/marketplace.functions";
import {
  VisaMark,
  MastercardMark,
  VerveMark,
  PaystackMark,
  FlutterwaveMark,
  MiniPayMark,
  MtnMomoMark,
  BankTransferMark,
} from "@/components/oventric/desktop/PaymentLogos";

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
/* Trending category tiles (G2G-style)                                   */
/* ------------------------------------------------------------------ */

type CategoryBucket = {
  name: string;
  normalized: string;
  count: number;
  cover: string | null;
};

function norm(s: string) {
  return s.toLowerCase().trim();
}

function groupByCategory(rows: ProductDTO[]): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>();
  rows.forEach((p) => {
    const key = norm(p.category) || "other";
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.cover && p.coverUrl) existing.cover = p.coverUrl;
    } else {
      map.set(key, {
        name: p.category || "Other",
        normalized: key,
        count: 1,
        cover: p.coverUrl ?? null,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function CategoryTile({ cat, onSelect }: { cat: CategoryBucket; onSelect: (section: string) => void }) {
  const initial = cat.name.slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => onSelect("Marketplace")}
      className="group relative flex aspect-square w-full flex-col overflow-hidden rounded-2xl text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden bg-slate-900">
        {cat.cover ? (
          <img
            src={cat.cover}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-full w-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-900/20" />
      </div>

      {/* Offers badge */}
      <div className="relative z-10 self-end rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm">
        {cat.count} Offers
      </div>

      {/* Center mark */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-white/20 bg-white/10 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <span className="text-4xl font-black text-white/95">{initial}</span>
        </div>
      </div>

      {/* Title only */}
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
          <span className="truncate text-base font-bold text-white">{cat.name}</span>
        </div>
      </div>
    </button>
  );
}

export function ProductRails({ onSelect }: { onSelect: (section: string) => void }) {
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

  const categories = useMemo(() => groupByCategory(rows.filter((r) => r.status === "active")), [rows]);
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1200px] px-8 pt-16">
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.6} /> Trending on the marketplace
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Browse by category</h2>
          <p className="mt-1 text-sm text-slate-500">Explore active listings grouped by what you need.</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <CategoryTile key={cat.normalized} cat={cat} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Secured payments                                                    */
/* ------------------------------------------------------------------ */

const METHODS = [
  { name: "Visa", Mark: VisaMark },
  { name: "Mastercard", Mark: MastercardMark },
  { name: "Verve", Mark: VerveMark },
  { name: "Paystack", Mark: PaystackMark },
  { name: "Flutterwave", Mark: FlutterwaveMark },
  { name: "MiniPay", Mark: MiniPayMark },
  { name: "MTN MoMo", Mark: MtnMomoMark },
  { name: "Bank transfer", Mark: BankTransferMark },
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
      </div>

      {/* Solid tinted band — logos only, not interactive */}
      <div aria-hidden={false} className="w-full bg-[#EFEDF4] py-8">
        <ul className="mx-auto flex w-full max-w-[1400px] list-none flex-wrap items-center justify-center gap-x-14 gap-y-7 px-8">
          {METHODS.map(({ name, Mark }) => (
            <li key={name} title={name} className="pointer-events-none flex items-center">
              <Mark />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

