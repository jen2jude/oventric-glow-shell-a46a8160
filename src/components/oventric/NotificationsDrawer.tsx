import { useMemo, useState } from "react";
import {
  X,
  Wallet as WalletIcon,
  Users,
  Timer,
  ShieldAlert,
  ArrowRight,
  Check,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

type Channel = "all" | "financials" | "circles" | "bounties" | "moderation";

type BaseNotif = {
  id: string;
  channel: Exclude<Channel, "all">;
  createdAt: string;
  read: boolean;
};
type FinancialNotif = BaseNotif & {
  kind: "financial";
  amountUsd: number;
  contract: string;
};
type CircleNotif = BaseNotif & {
  kind: "circle";
  name: string;
  initials: string;
  accepted?: boolean;
  declined?: boolean;
};
type BountyNotif = BaseNotif & {
  kind: "bounty";
  task: string;
  taskId: string;
  hoursLeft: number;
};
type ModerationNotif = BaseNotif & { kind: "moderation"; postRef: string };
type Notif = FinancialNotif | CircleNotif | BountyNotif | ModerationNotif;

const SEED: Notif[] = [
  {
    id: "n1",
    kind: "financial",
    channel: "financials",
    amountUsd: 1250,
    contract: "0983",
    createdAt: "2m",
    read: false,
  },
  {
    id: "n2",
    kind: "circle",
    channel: "circles",
    name: "Ada Lovelace",
    initials: "AL",
    createdAt: "9m",
    read: false,
  },
  {
    id: "n3",
    kind: "bounty",
    channel: "bounties",
    task: "Fix Webhook Sync",
    taskId: "104",
    hoursLeft: 71,
    createdAt: "34m",
    read: false,
  },
  {
    id: "n4",
    kind: "moderation",
    channel: "moderation",
    postRef: "post_44a1",
    createdAt: "2h",
    read: true,
  },
  {
    id: "n5",
    kind: "financial",
    channel: "financials",
    amountUsd: 420,
    contract: "0971",
    createdAt: "5h",
    read: true,
  },
  {
    id: "n6",
    kind: "circle",
    channel: "circles",
    name: "Kwame Mensah",
    initials: "KM",
    createdAt: "1d",
    read: true,
  },
];

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "financials", label: "💳 Financials" },
  { key: "circles", label: "👥 Circles" },
  { key: "bounties", label: "🎯 Bounties" },
];

export function NotificationsDrawer({
  open,
  onClose,
  items,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  items: Notif[];
  onUpdate: (next: Notif[]) => void;
}) {
  const { baseCurrency } = useOnboarding();
  const [channel, setChannel] = useState<Channel>("all");

  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const money = (usd: number) =>
    `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const filtered = useMemo(
    () => (channel === "all" ? items : items.filter((n) => n.channel === channel)),
    [items, channel],
  );

  const markAllRead = () => onUpdate(items.map((n) => ({ ...n, read: true })));
  const patch = (id: string, p: Partial<Notif>) =>
    onUpdate(items.map((n) => (n.id === id ? ({ ...n, ...p } as Notif) : n)));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`w-full sm:w-[400px] h-screen bg-[#1E1E24] border-l border-white/5 shadow-2xl z-50 fixed right-0 top-0 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-sm">Notifications</h2>
            <p className="text-[11px] text-slate-500">Real-time activity across your workspace</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channel pills */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/5">
          {CHANNELS.map((c) => {
            const active = channel === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setChannel(c.key)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors border ${
                  active
                    ? "bg-white text-black border-white"
                    : "bg-[#121214] text-slate-400 border-white/10 hover:text-white hover:border-white/20"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Stream */}
        <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(100vh - 8.5rem - 3.25rem)" }}>
          {filtered.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-10">
              You're all caught up in this channel.
            </div>
          ) : (
            filtered.map((n) => (
              <NotifCard
                key={n.id}
                n={n}
                money={money}
                onAcceptCircle={() => patch(n.id, { accepted: true, declined: false, read: true } as Partial<Notif>)}
                onDeclineCircle={() => patch(n.id, { declined: true, accepted: false, read: true } as Partial<Notif>)}
                onOpen={() => patch(n.id, { read: true })}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 inset-x-0 px-4 py-3 border-t border-white/5 bg-[#1E1E24]">
          <button
            onClick={markAllRead}
            className="w-full py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-[#121214] border border-white/10 hover:border-emerald-500/40 transition-colors"
          >
            Mark All as Read
          </button>
        </div>
      </aside>
    </>
  );
}

function NotifCard({
  n,
  money,
  onAcceptCircle,
  onDeclineCircle,
  onOpen,
}: {
  n: Notif;
  money: (usd: number) => string;
  onAcceptCircle: () => void;
  onDeclineCircle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={`bg-[#121214] border border-white/5 rounded-xl p-3 mb-3 transition-all hover:border-white/10 ${
        !n.read ? "ring-1 ring-emerald-500/20" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <IconBadge kind={n.kind} unread={!n.read} />
        <div className="flex-1 min-w-0">
          {n.kind === "financial" && (
            <>
              <p className="text-[13px] leading-snug text-slate-200">
                <span className="font-semibold text-white">Escrow Locked:</span> Payout balance of{" "}
                <span className="font-black text-emerald-400">{money(n.amountUsd)}</span> has been
                verified and safely bound to Contract #{n.contract}.
              </p>
              <TimeRow t={n.createdAt} />
            </>
          )}

          {n.kind === "circle" && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-black text-[10px] font-black flex items-center justify-center">
                  {n.initials}
                </div>
                <p className="text-[13px] leading-snug text-slate-200">
                  <span className="font-semibold text-white">{n.name}</span> has requested to join
                  your Peer Circle.
                </p>
              </div>
              <TimeRow t={n.createdAt} />
              {n.accepted ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <Check className="w-3.5 h-3.5" /> In Your Circle
                </div>
              ) : n.declined ? (
                <div className="mt-2 text-[11px] text-slate-500">Request declined</div>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={onAcceptCircle}
                    className="px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={onDeclineCircle}
                    className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              )}
            </>
          )}

          {n.kind === "bounty" && (
            <>
              <p className="text-[13px] leading-snug text-slate-200">
                <span className="font-semibold text-white">Review Requested:</span> Developer has
                marked Task #{n.taskId} (
                <span className="text-slate-300">‘{n.task}’</span>) as complete. Your{" "}
                <span className="font-semibold text-amber-300">{n.hoursLeft}h</span> review window
                is ticking down.
              </p>
              <TimeRow t={n.createdAt} />
              <button
                onClick={onOpen}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Inspect Workspace <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}

          {n.kind === "moderation" && (
            <>
              <p className="text-[13px] leading-snug text-slate-200">
                <span className="font-semibold text-white">Action Taken:</span> A social post you
                flagged has been processed by an automated system administrator moderator.
              </p>
              <TimeRow t={n.createdAt} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBadge({ kind, unread }: { kind: Notif["kind"]; unread: boolean }) {
  const base =
    "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border relative";
  if (kind === "financial")
    return (
      <div className={`${base} bg-emerald-500/10 border-emerald-500/30 text-emerald-400`}>
        <WalletIcon className="w-4 h-4" />
        {unread && <Dot />}
      </div>
    );
  if (kind === "circle")
    return (
      <div className={`${base} bg-sky-500/10 border-sky-500/30 text-sky-300`}>
        <Users className="w-4 h-4" />
        {unread && <Dot />}
      </div>
    );
  if (kind === "bounty")
    return (
      <div className={`${base} bg-purple-500/10 border-purple-500/30 text-purple-300`}>
        <Timer className="w-4 h-4 animate-pulse" />
        {unread && <Dot />}
      </div>
    );
  return (
    <div className={`${base} bg-amber-500/10 border-amber-500/30 text-amber-300`}>
      <ShieldAlert className="w-4 h-4" />
      {unread && <Dot />}
    </div>
  );
}

const Dot = () => (
  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 rgb-pulse-glow" />
);

const TimeRow = ({ t }: { t: string }) => (
  <div className="text-[10px] text-slate-500 mt-1">{t} ago</div>
);

export type { Notif };
export { SEED as SEED_NOTIFICATIONS };
