import { BadgePercent, ShieldCheck, Smartphone } from "lucide-react";

/**
 * Temu-style full-width trust strip across the top of the marketplace.
 * The "Get the Oventric App" item is desktop-only.
 */
export function MarketplaceBanner() {
  return (
    <div className="w-full bg-slate-950 text-emerald-300">
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-4">
        <div className="flex items-stretch gap-3 sm:gap-6 overflow-x-auto scrollbar-none py-2.5">
          <Item
            Icon={BadgePercent}
            title="Get up to 10% cashback on purchase"
            sub="Credited to your cashback wallet"
          />
          <Divider />
          <Item
            Icon={ShieldCheck}
            title="Buy from real verified vendors"
            sub="Escrow-protected on every order"
          />
          <div className="hidden md:flex items-stretch gap-3 sm:gap-6">
            <Divider />
            <Item Icon={Smartphone} title="Get the Oventric App" sub="iOS & Android" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px shrink-0 bg-white/15 self-stretch" />;
}

function Item({
  Icon,
  title,
  sub,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-1 min-w-max items-center justify-center gap-2.5 px-1">
      <Icon className="w-6 h-6 shrink-0 text-emerald-400" />
      <div className="min-w-0">
        <div className="text-[13px] sm:text-sm font-extrabold leading-tight text-emerald-300 whitespace-nowrap">
          {title}
        </div>
        <div className="text-[11px] sm:text-xs text-emerald-100/70 leading-tight whitespace-nowrap">
          {sub}
        </div>
      </div>
    </div>
  );
}
