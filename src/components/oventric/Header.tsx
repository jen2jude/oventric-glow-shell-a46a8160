import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, KeyRound, X, Shield, Grip, Menu, Bell, UserPlus, MessageSquare, Users } from "lucide-react";
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
import supportHeadset from "@/assets/support-headset.png.asset.json";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listIncomingFollowRequests } from "@/lib/follows.functions";
import { listIncomingCircleRequests } from "@/lib/circles.functions";
import { CountBadge } from "@/components/oventric/CountBadge";
import { HeaderWalletChip } from "@/components/oventric/HeaderWalletChip";


export function Header({ onMenuClick, onOpenMessages, safeMobile = false, showMobileTopRow = false, hubMode = false, light = false }: { onMenuClick?: () => void; onOpenMessages?: () => void; safeMobile?: boolean; showMobileTopRow?: boolean; hubMode?: boolean; light?: boolean }) {
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

  const bg = light
    ? "bg-white"
    : safeMobile
      ? "bg-[#121214] md:bg-[#121214]/90 md:backdrop-blur-md"
      : "bg-[#121214]/90 backdrop-blur-md";
  const edge = light ? "border-slate-200" : "border-white/10";
  // Round icon buttons in the right cluster.
  const chip = light
    ? "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
    : "bg-[#1E1E24] border border-white/10 text-white";
  // Flat (no pill) icon buttons.
  const flat = light ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/5";

  const LogoImg = (
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

  const LogoMark = light ? (
    <span className="inline-flex items-center rounded-xl bg-slate-900 px-2 py-1">{LogoImg}</span>
  ) : (
    LogoImg
  );

  const searchOverlay = mobileSearchOpen ? (
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
  ) : null;

  // Home hub gets a stripped-back header: logo, search, help and menu only.
  // Fixed positioning keeps it pinned for the full Home hub scroll.
  if (hubMode) {
    return (
      <header className={`fixed top-0 left-0 right-0 z-40 w-full ${bg} border-b ${edge}`}>
        <div className="h-12 md:h-[4.5rem] flex items-center gap-2 md:gap-4 px-3 md:px-6">
          <Link to="/" aria-label="Oventric" className="flex items-center shrink-0">
            {LogoMark}
          </Link>

          <div className="flex-1 max-w-xl mx-auto min-w-0 hidden sm:block">
            <GlobalSearch variant="inline" />
          </div>

          <div className="ml-auto sm:ml-0 flex items-center gap-0.5 md:gap-1 shrink-0">
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Open search"
              className={`sm:hidden p-2 md:p-2.5 rounded-xl transition-colors ${flat}`}
            >
              <Search className="w-5 h-5" strokeWidth={2.5} />
            </button>

            <Link
              to="/help-board"
              aria-label="Help board"
              className={`inline-flex p-2 md:p-2.5 rounded-xl transition-colors shrink-0 ${flat}`}
            >
              <img
                src={supportHeadset.url}
                alt="Help board"
                className="w-5 h-5 md:w-6 md:h-6 headset-fluid object-contain"
                draggable={false}
              />
            </Link>

            <button
              onClick={() => setMegaOpen(true)}
              aria-label="Open menu"
              className={`inline-flex p-2 md:p-2.5 rounded-xl transition-colors shrink-0 ${flat}`}
            >
              <Menu className="w-5 h-5 md:hidden" strokeWidth={2.5} />
              <Grip className="w-6 h-6 hidden md:block" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />
        {searchOverlay}
      </header>
    );
  }

  return (
    <header className={`sticky top-0 z-40 w-full ${bg} border-b ${edge}`}>
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
              className={`hidden md:flex p-2.5 rounded-lg transition-colors shrink-0 ${flat}`}
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

        <div className="flex items-center justify-between md:justify-start gap-1 md:gap-2.5 w-full md:w-auto shrink-0 min-w-0">
          {/* Wallet chip - desktop/tablet position in the right cluster */}
          <div className="hidden md:inline-flex shrink-0">
            <HeaderWalletChip align="right" />
          </div>

          {/* Desktop candy-box menu */}
          <button
            onClick={() => setMegaOpen(true)}
            aria-label="Open menu"
            className={`hidden md:inline-flex p-2.5 rounded-full transition-colors shrink-0 ${chip}`}
          >
            <Grip className="w-6 h-6" strokeWidth={2.5} />
          </button>

          {/* Circles & Guilds */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("oventric:navigate", { detail: { section: "Circles" } }))}
            aria-label="Circles & Guilds"
            className={`relative inline-flex p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
          >
            <Users className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(true)}
            aria-label="Open notifications"
            className={`relative p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
          >
            <Bell className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
            <CountBadge count={unreadCount} ariaLabel={`${unreadCount} unread notifications`} />
          </button>

          {/* Merged Follow + Circle requests */}
          <button
            onClick={() => setFollowReqOpen(true)}
            aria-label={`Requests (${pendingFollow + pendingCircles} pending)`}
            className={`relative inline-flex p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
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
            className={`relative p-2 md:p-2.5 rounded-full ${chip} transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 active:translate-y-0 shrink-0`}
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
              <span className={`inline-flex items-center gap-1.5 h-full w-full px-2.5 md:px-3 rounded-full font-bold text-xs sm:text-sm ${light ? "bg-white text-slate-900" : "bg-[#1E1E24] text-white"}`}>
                <KeyRound className="w-4 h-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">Connect Account</span>
                <span className="sm:hidden">Connect</span>
              </span>
            </button>
          )}
        </div>
      </div>

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <RequestsInboxDrawer open={followReqOpen} onClose={() => setFollowReqOpen(false)} />
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

