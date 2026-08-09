import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, MessageSquare, Search, Plus } from "lucide-react";
import logoFull from "@/assets/oventric-full-transparent.png";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { CountBadge } from "@/components/oventric/CountBadge";
import {
  NotificationsDrawer,
  useUnreadNotificationsCount,
} from "@/components/oventric/NotificationsDrawer";
import { MessagesDrawer } from "@/components/oventric/MessagesDrawer";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { getTopUsers, type TopUser } from "@/lib/top-users.functions";

export type FeedTab = "foryou" | "following" | "discover";

const TABS: { key: FeedTab; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "discover", label: "Discover" },
];

/** Ring gradients cycled across story avatars so the rail feels alive. */
const RINGS = [
  "from-[#E5484D] via-[#F2686C] to-[#7C6CF6]",
  "from-[#7C6CF6] via-[#E5484D] to-[#F5A524]",
  "from-[#F5A524] via-[#E5484D] to-[#7C6CF6]",
  "from-[#30A46C] via-[#7C6CF6] to-[#E5484D]",
];

type Props = {
  tab: FeedTab;
  onTabChange: (t: FeedTab) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  meAvatarUrl: string | null;
  meInitials: string;
  meSlug: string | null;
  onAddStory: () => void;
};

/**
 * App-shell newsfeed chrome: brand header, For you / Following / Discover
 * tabs and the stories rail. Mirrors the premium dark reference design.
 */
export function FeedAppChrome({
  tab,
  onTabChange,
  searchOpen,
  onToggleSearch,
  meAvatarUrl,
  meInitials,
  meSlug,
  onAddStory,
}: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [people, setPeople] = useState<TopUser[]>([]);
  const chromeRef = useRef<HTMLDivElement>(null);

  useScrollHideChrome(true, chromeRef);
  const chromeHidden = useChromeHidden();

  const unreadNotifs = useUnreadNotificationsCount();
  const { messages } = useUnreadCounts();
  const loadTopUsers = useServerFn(getTopUsers);

  useEffect(() => {
    let cancelled = false;
    loadTopUsers()
      .then((r) => {
        if (!cancelled) setPeople(r.users ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadTopUsers]);

  return (
    <div
      ref={chromeRef}
      className="-mx-4 sticky top-0 z-30 bg-[#0A0A0B]"
    >
      {/* Brand header — stays pinned; only fades slightly on scroll down */}
      <div>
        <div className="min-h-0">
        <div className="flex items-center gap-2 px-4 pt-1 pb-2">
        <img src={logoFull} alt="Oventric" className="h-7 w-auto shrink-0" />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label="Search"
            className={`grid h-9 w-9 place-items-center rounded-full transition-colors active:scale-95 ${
              searchOpen ? "bg-[#E5484D]/15 text-[#E5484D]" : "text-white/80 hover:text-white"
            }`}
          >
            <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label="Notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full text-white/80 transition-colors hover:text-white active:scale-95"
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <CountBadge count={unreadNotifs} ariaLabel={`${unreadNotifs} new notifications`} />
          </button>
          <button
            type="button"
            onClick={() => setMsgOpen(true)}
            aria-label="Messages"
            className="relative grid h-9 w-9 place-items-center rounded-full text-white/80 transition-colors hover:text-white active:scale-95"
          >
            <MessageSquare className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <CountBadge count={messages ?? 0} ariaLabel={`${messages ?? 0} unread messages`} />
          </button>
          {meSlug ? (
            <Link
              to="/profile/$id"
              params={{ id: meSlug }}
              aria-label="Your profile"
              className="ml-1 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#1A1A1F] ring-1 ring-white/10 active:scale-95"
            >
              <AvatarImage src={meAvatarUrl} alt="You" initials={meInitials} />
            </Link>
          ) : (
            <span className="ml-1 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#1A1A1F] ring-1 ring-white/10">
              <AvatarImage src={meAvatarUrl} alt="You" initials={meInitials} />
            </span>
          )}
        </div>
        </div>
        </div>
      </div>




      {/* Tabs */}
      <div className="grid grid-cols-3 px-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className="relative py-2.5 text-[13.5px] font-semibold transition-colors"
            >
              <span className={active ? "text-white" : "text-white/45"}>{t.label}</span>
              <span
                className={`absolute bottom-0 left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-[#E5484D] transition-all duration-300 ${
                  active ? "w-10 opacity-100" : "w-0 opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="h-px w-full bg-white/[0.07]" />

      {/* Stories rail */}
      <div className="flex gap-4 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={onAddStory}
          className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
        >
          <span className="relative block h-[58px] w-[58px]">
            <span className="block h-full w-full overflow-hidden rounded-full bg-[#1A1A1F] ring-1 ring-white/10">
              <AvatarImage src={meAvatarUrl} alt="Your story" initials={meInitials} />
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-[#0A0A0B] bg-[#E5484D]">
              <Plus className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
            Your story
          </span>
        </button>

        {people.map((u, i) => (
          <Link
            key={u.userId}
            to="/profile/$id"
            params={{ id: u.slug }}
            className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
          >
            <span
              className={`grid h-[58px] w-[58px] place-items-center rounded-full bg-gradient-to-tr p-[2px] ${
                RINGS[i % RINGS.length]
              }`}
            >
              <span className="block h-full w-full overflow-hidden rounded-full border-2 border-[#0A0A0B] bg-[#1A1A1F]">
                <AvatarImage src={u.avatarUrl} alt={u.displayName} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-white/70">
              {u.displayName.split(" ")[0]}
            </span>
          </Link>
        ))}
      </div>
      <div className="h-px w-full bg-white/[0.07]" />

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <MessagesDrawer open={msgOpen} onClose={() => setMsgOpen(false)} />
    </div>
  );
}
