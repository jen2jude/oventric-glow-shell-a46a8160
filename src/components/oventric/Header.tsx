import { useState } from "react";
import { Search, Bell, MessageCircle, Menu } from "lucide-react";
import { IncomingCircleInbox } from "@/components/oventric/IncomingCircleInbox";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";
import {
  NotificationsDrawer,
  SEED_NOTIFICATIONS,
  type Notif,
} from "@/components/oventric/NotificationsDrawer";
import logoMark from "@/assets/oventric-mark.asset.json";
import logoFull from "@/assets/oventric-full.asset.json";

export function Header({ onMenuClick, onOpenMessages }: { onMenuClick?: () => void; onOpenMessages?: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(SEED_NOTIFICATIONS);
  const unread = notifs.some((n) => !n.read);

  return (
    <header className="sticky top-0 z-40 h-16 w-full bg-[#121214]/90 backdrop-blur-md border-b border-white/10 flex items-center gap-3 px-4 md:px-6">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="hidden md:flex p-2 rounded-lg hover:bg-white/5 text-slate-300 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <div className="flex items-center shrink-0">
        {/* Mobile: ring-only mark */}
        <img
          src={logoMark.url}
          alt="Oventric"
          className="sm:hidden h-9 w-9 object-contain [mix-blend-mode:screen]"
          draggable={false}
        />
        {/* Tablet & desktop: full wordmark */}
        <img
          src={logoFull.url}
          alt="Oventric"
          className="hidden sm:block h-9 w-auto object-contain [mix-blend-mode:screen]"
          draggable={false}
        />
      </div>


      <div className="flex-1 max-w-xl mx-auto min-w-0 hidden sm:block">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
          <input
            type="text"
            placeholder="Search creators, bounties, assets…"
            className="w-full h-10 pl-10 pr-4 bg-[#1E1E24] border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button className="sm:hidden p-2 rounded-lg hover:bg-white/5 text-slate-300">
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={() => setNotifOpen(true)}
          aria-label="Open notifications"
          className="relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unread && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 rgb-pulse-glow"
              aria-hidden
            />
          )}
        </button>
        <IncomingCircleInbox />
        <button
          onClick={onOpenMessages}
          aria-label="Open messages"
          className="relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        </button>
        <ProfileDropdown />
      </div>

      <NotificationsDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notifs}
        onUpdate={setNotifs}
      />
    </header>
  );
}
