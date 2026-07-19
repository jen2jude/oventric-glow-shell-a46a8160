import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Bell, MessageCircle, Menu, KeyRound, X, Shield, Grip, UserPlus } from "lucide-react";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { FollowRequestsDrawer } from "@/components/oventric/FollowRequestsDrawer";
import { IncomingCircleInbox } from "@/components/oventric/IncomingCircleInbox";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { GlobalSearch } from "@/components/oventric/GlobalSearch";
import logoFull from "@/assets/oventric-full.asset.json";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listIncomingFollowRequests } from "@/lib/follows.functions";

export function Header({ onMenuClick, onOpenMessages, safeMobile = false, showMobileTopRow = false }: { onMenuClick?: () => void; onOpenMessages?: () => void; safeMobile?: boolean; showMobileTopRow?: boolean }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [followReqOpen, setFollowReqOpen] = useState(false);
  const unreadCount = useUnreadNotificationsCount();
  const unread = unreadCount > 0;
  const unreadMessages = useUnreadMessagesCount();
  const pendingFollow = usePendingFollowRequestsCount();
  const { isAuthenticated, openGate } = useAuthGate();

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileSearchOpen]);

  // Reopen MegaMenu when the user navigates back to the page where it was opened.
  useEffect(() => {
    const KEY = "oventric:megamenu-return-path";
    const onPop = () => {
      const stored = sessionStorage.getItem(KEY);
      if (stored && stored === window.location.pathname) {
        sessionStorage.removeItem(KEY);
        setMegaOpen(true);
      }
    };
    const onOpenReq = () => setMegaOpen(true);
    window.addEventListener("popstate", onPop);
    window.addEventListener("oventric:open-megamenu", onOpenReq);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("oventric:open-megamenu", onOpenReq);
    };
  }, []);

  useEffect(() => {
    const handler = () => onOpenMessages?.();
    window.addEventListener("oventric:open-messages", handler);
    return () => window.removeEventListener("oventric:open-messages", handler);
  }, [onOpenMessages]);

  const bg = safeMobile ? "bg-[#121214] md:bg-[#121214]/90 md:backdrop-blur-md" : "bg-[#121214]/90 backdrop-blur-md";

  const LogoMark = (
    <ResponsiveImage
      src={logoFull.url}
      alt="Oventric"
      sizes="160px"
      className="h-8 w-auto object-contain rounded-[10px] [mix-blend-mode:screen]"
      style={{
        WebkitMaskImage:
          "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
      draggable={false}
    />
  );

  return (
    <header className={`sticky top-0 z-40 w-full ${bg} border-b border-white/10`}>
      {/* Mobile top row: logo + search + hamburger (home only) */}
      {showMobileTopRow && (
        <div className="md:hidden flex items-center gap-3 h-12 px-4 border-b border-white/5">
          <Link to="/" aria-label="Oventric" className="flex items-center">
            {LogoMark}
          </Link>
          <button
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Open search"
            className="ml-auto p-2 rounded-lg hover:bg-white/5 text-slate-300"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMegaOpen(true)}
            aria-label="Open menu"
            className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-slate-300"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main row */}
      <div className="h-16 flex items-center gap-3 px-4 md:px-6">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="hidden md:flex p-2 rounded-lg hover:bg-white/5 text-slate-300 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {/* Desktop-only logo */}
        <Link to="/" aria-label="Oventric" className="hidden md:flex items-center shrink-0">
          {LogoMark}
        </Link>

        {/* Desktop search input */}
        <div className="flex-1 max-w-xl mx-auto min-w-0 hidden sm:block">
          <GlobalSearch variant="inline" />
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Circles & Guilds - mobile only in bottom row */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Circles" } }))}
            aria-label="Circles & Guilds"
            className="md:hidden p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <Shield className="w-5 h-5" />
          </button>

          {/* Desktop candy-box menu */}
          <button
            onClick={() => setMegaOpen(true)}
            aria-label="Open menu"
            className="hidden md:inline-flex p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <Grip className="w-5 h-5" />
          </button>

          {/* Notifications */}
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

          {/* Follow requests */}
          <button
            onClick={() => setFollowReqOpen(true)}
            aria-label="Follow requests"
            className="relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            {pendingFollow > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center rgb-pulse-glow"
                aria-label={`${pendingFollow} pending follow requests`}
              >
                {pendingFollow > 9 ? "9+" : pendingFollow}
              </span>
            )}
          </button>

          {/* Circle join inbox: keep on desktop only so it stays reachable */}
          <div className="hidden md:inline-flex">
            <IncomingCircleInbox />
          </div>

          {/* Chat */}
          <button
            onClick={onOpenMessages}
            aria-label="Open messages"
            className="relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            {unreadMessages > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-black text-[9px] font-black flex items-center justify-center rgb-pulse-glow"
                aria-label={`${unreadMessages} unread messages`}
              >
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            ) : (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400/40" />
            )}
          </button>

          {/* Profile */}
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
      </div>

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <FollowRequestsDrawer open={followReqOpen} onClose={() => setFollowReqOpen(false)} />
      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />

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

function useUnreadMessagesCount() {
  const { isAuthenticated } = useAuthGate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let userId: string | null = null;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      if (!userId) return;
      const { count: c } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId || cancelled) return;
      await load();
      channelSub = supabase
        .channel(`dm-count-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${userId}` },
          () => { void load(); },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "direct_messages", filter: `sender_id=eq.${userId}` },
          () => { void load(); },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated]);

  return count;
}

function usePendingFollowRequestsCount() {
  const { isAuthenticated } = useAuthGate();
  const listFn = useServerFn(listIncomingFollowRequests);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) { setCount(0); return; }
    let cancelled = false;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = () => {
      listFn()
        .then((rows) => { if (!cancelled) setCount(Array.isArray(rows) ? rows.length : 0); })
        .catch(() => { if (!cancelled) setCount(0); });
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      load();
      channelSub = supabase
        .channel(`follow-req-count-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "follow_requests", filter: `target_id=eq.${uid}` },
          () => load(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelSub) supabase.removeChannel(channelSub);
    };
  }, [isAuthenticated, listFn]);

  return count;
}
