import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, KeyRound, X, Shield, Grip, Menu, Bell, UserPlus, MessageSquare } from "lucide-react";
import { MegaMenu } from "@/components/oventric/MegaMenu";
import { ProfileDropdown } from "@/components/oventric/ProfileDropdown";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { RequestsInboxDrawer } from "@/components/oventric/RequestsInboxDrawer";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import { GlobalSearch } from "@/components/oventric/GlobalSearch";
import logoFull from "@/assets/oventric-full.asset.json";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listIncomingFollowRequests } from "@/lib/follows.functions";
import { listIncomingCircleRequests } from "@/lib/circles.functions";
import { CountBadge } from "@/components/oventric/CountBadge";
import { HeaderWalletChip } from "@/components/oventric/HeaderWalletChip";


export function Header({ onMenuClick, onOpenMessages, safeMobile = false, showMobileTopRow = false }: { onMenuClick?: () => void; onOpenMessages?: () => void; safeMobile?: boolean; showMobileTopRow?: boolean }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [followReqOpen, setFollowReqOpen] = useState(false);
  const unreadCount = useUnreadNotificationsCount();
  const unreadMessages = useUnreadMessagesCount();
  const pendingFollow = usePendingFollowRequestsCount();
  const pendingCircles = usePendingCircleRequestsCount();

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
        <div className="md:hidden grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 h-11 px-3 border-b border-white/5">
          <Link to="/" aria-label="Oventric" className="flex items-center shrink-0">
            {LogoMark}
          </Link>
          <div className="min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Open search"
              className="p-2 rounded-lg hover:bg-white/5 text-white"
            >
              <Search className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMegaOpen(true)}
              aria-label="Open menu"
              className="p-2 -mr-1 rounded-lg hover:bg-white/5 text-white"
            >
              <Menu className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Main row */}
      <div className="h-11 md:h-[4.5rem] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 md:gap-3 px-3 md:px-6">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="hidden md:flex p-2.5 rounded-lg hover:bg-white/5 text-white transition-colors shrink-0"
            >
              <Menu className="w-6 h-6" strokeWidth={2.5} />
            </button>
          )}
          {/* Desktop-only logo */}
          <Link to="/" aria-label="Oventric" className="hidden md:flex items-center shrink-0">
            {LogoMark}
          </Link>

          {/* Wallet chip - mobile only on the left */}
          <div className="md:hidden shrink-0">
            <HeaderWalletChip align="left" compact />
          </div>
        </div>

        {/* Desktop search input */}
        <div className="flex-1 max-w-xl mx-auto min-w-0 hidden sm:block">
          <GlobalSearch variant="inline" />
        </div>

        <div className="flex items-center gap-1 md:gap-2.5 shrink-0 min-w-0">
          {/* Wallet chip - desktop/tablet position in the right cluster */}
          <div className="hidden md:inline-flex shrink-0">
            <HeaderWalletChip align="right" />
          </div>

          {/* Desktop candy-box menu */}
          <button
            onClick={() => setMegaOpen(true)}
            aria-label="Open menu"
            className="hidden md:inline-flex p-2.5 rounded-full bg-[#1E1E24] border border-white/10 text-white hover:text-white transition-colors shrink-0"
          >
            <Grip className="w-6 h-6" strokeWidth={2.5} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(true)}
            aria-label="Open notifications"
            className="relative p-2 md:p-2.5 rounded-full bg-[#1E1E24] border border-white/10 text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0"
          >
            <Bell className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge count={unreadCount} ariaLabel={`${unreadCount} unread notifications`} />
          </button>

          {/* Merged Follow + Circle requests */}
          <button
            onClick={() => setFollowReqOpen(true)}
            aria-label={`Requests (${pendingFollow + pendingCircles} pending)`}
            className="relative inline-flex p-2 md:p-2.5 rounded-full bg-[#1E1E24] border border-white/10 text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0"
          >
            <UserPlus className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge
              count={pendingFollow + pendingCircles}
              ariaLabel={`${pendingFollow + pendingCircles} pending follow and circle requests`}
            />
          </button>



          {/* Chat */}
          <button
            onClick={onOpenMessages}
            aria-label="Open messages"
            className="relative p-2 md:p-2.5 rounded-full bg-[#1E1E24] border border-white/10 text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0"
          >
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge count={unreadMessages} ariaLabel={`${unreadMessages} unread messages`} />
          </button>

          {/* Profile */}
          {isAuthenticated ? (
            <div className="shrink-0">
              <ProfileDropdown />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openGate("generic")}
              className="inline-flex items-center justify-center h-9 md:h-10 rounded-full rgb-static-border p-[2px] hover:opacity-90 transition-opacity shrink-0"
              aria-label="Connect account"
            >
              <span className="inline-flex items-center gap-1.5 h-full w-full px-2.5 md:px-3 rounded-full bg-[#1E1E24] text-white font-bold text-xs sm:text-sm">
                <KeyRound className="w-4 h-4 text-white" strokeWidth={2.5} />
                <span className="hidden sm:inline">Connect Account</span>
                <span className="sm:hidden">Connect</span>
              </span>
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

    const load = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { if (!cancelled) setCount(0); return; }
      try {
        const rows = await listFn();
        if (!cancelled) setCount(Array.isArray(rows) ? rows.length : 0);
      } catch { if (!cancelled) setCount(0); }
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

function usePendingCircleRequestsCount() {
  const { isAuthenticated } = useAuthGate();
  const listFn = useServerFn(listIncomingCircleRequests);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) { setCount(0); return; }
    let cancelled = false;
    let channelSub: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { if (!cancelled) setCount(0); return; }
      try {
        const rows = await listFn();
        if (!cancelled) setCount(Array.isArray(rows) ? rows.length : 0);
      } catch { if (!cancelled) setCount(0); }
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      load();
      channelSub = supabase
        .channel(`circle-req-count-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "circle_requests", filter: `target_id=eq.${uid}` },
          () => load(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "circle_join_requests" },
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

