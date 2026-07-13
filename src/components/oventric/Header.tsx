import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Bell, MessageCircle, Menu, KeyRound, X, Shield } from "lucide-react";
import { IncomingCircleInbox } from "@/components/oventric/IncomingCircleInbox";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { GlobalSearch } from "@/components/oventric/GlobalSearch";
import logoMark from "@/assets/oventric-mark.asset.json";
import logoFull from "@/assets/oventric-full.asset.json";

export function Header({ onMenuClick, onOpenMessages }: { onMenuClick?: () => void; onOpenMessages?: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const unreadCount = useUnreadNotificationsCount();
  const unread = unreadCount > 0;
  const { isAuthenticated, openGate } = useAuthGate();

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileSearchOpen]);

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
      <Link
        to="/"
        aria-label="Oventric"
        className="flex items-center shrink-0"
      >
        {/* Mobile: ring-only mark — perfectly round with feathered edge blending into dark bg */}
        <img
          src={logoMark.url}
          alt="Oventric"
          className="sm:hidden h-9 w-9 object-cover rounded-full"
          style={{
            WebkitMaskImage: "radial-gradient(circle, black 82%, transparent 100%)",
            maskImage: "radial-gradient(circle, black 82%, transparent 100%)",
          }}
          draggable={false}
        />
        {/* Tablet & desktop: full wordmark — 10px rounded with feathered horizontal edges */}
        <img
          src={logoFull.url}
          alt="Oventric"
          className="hidden sm:block h-9 w-auto object-contain rounded-[10px] [mix-blend-mode:screen]"
          style={{
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
            maskImage:
              "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
          }}
          draggable={false}
        />
      </Link>


      <div className="flex-1 max-w-xl mx-auto min-w-0 hidden sm:block">
        <GlobalSearch variant="inline" />
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Open search"
          className="sm:hidden p-2 rounded-lg hover:bg-white/5 text-slate-300"
        >
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
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center rgb-pulse-glow"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
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
        {isAuthenticated ? (
          <ProfileDropdown />
        ) : (
          <button
            type="button"
            onClick={() => openGate("generic")}
            className="rgb-pulse-glow inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#121214] border border-emerald-500/50 text-white font-bold text-xs sm:text-sm hover:border-emerald-400 transition-colors"
            aria-label="Connect account"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">Connect Account</span>
            <span className="sm:hidden">Connect</span>
          </button>
        )}
      </div>

      <NotificationsDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />

      {mobileSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="sm:hidden fixed inset-0 z-[60] bg-[#0b0b0d]/95 backdrop-blur-md flex flex-col"
        >
          <div className="flex items-center gap-2 p-3 border-b border-white/10">
            <div className="flex-1 min-w-0">
              <GlobalSearch variant="sheet" autoFocus onClose={() => setMobileSearchOpen(false)} />
            </div>
            <button
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
              className="p-2 rounded-lg text-slate-300 hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
