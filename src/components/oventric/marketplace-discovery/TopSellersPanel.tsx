import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Star, BadgeCheck } from "lucide-react";
import { sendFollowRequest, unfollow } from "@/lib/follows.functions";
import type { SellerLite } from "./cards";

type Tab = "top" | "rising" | "followed";

const TABS: { key: Tab; label: string }[] = [
  { key: "top", label: "Top Sellers" },
  { key: "rising", label: "Rising Stars" },
  { key: "followed", label: "Most Followed" },
];

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

/** Full-screen Top Sellers leaderboard — 2-up grid of ranked seller cards. */
export function TopSellersPanel({
  sellers,
  onClose,
  onOpenShop,
}: {
  sellers: SellerLite[];
  onClose: () => void;
  onOpenShop: (slug: string) => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("top");
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const follow = useServerFn(sendFollowRequest);
  const unfollowFn = useServerFn(unfollow);

  const list = useMemo(() => {
    const copy = [...sellers];
    if (tab === "followed") copy.sort((a, b) => b.followersCount - a.followersCount);
    else if (tab === "rising") copy.sort((a, b) => b.rating - a.rating || b.followersCount - a.followersCount);
    else copy.sort((a, b) => b.productsCount - a.productsCount);
    return copy;
  }, [sellers, tab]);

  const toggleFollow = async (s: SellerLite) => {
    const next = !following[s.id];
    setFollowing((f) => ({ ...f, [s.id]: next }));
    try {
      if (next) await follow({ data: { targetId: s.id } });
      else await unfollowFn({ data: { targetId: s.id } });
    } catch {
      setFollowing((f) => ({ ...f, [s.id]: !next }));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0A0A0B]">
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.04] text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-bold tracking-tight text-white">Top Sellers</h1>
        <span className="w-9" />
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold transition-colors ${
              tab === t.key ? "bg-[#E5484D] text-white" : "bg-[#141416] text-white/55"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">
        <div className="grid grid-cols-2 gap-3">
          {list.map((s, i) => (
            <article
              key={s.id}
              className="relative rounded-[22px] border border-white/[0.05] bg-[#131316] p-3"
            >
              <span
                className={`absolute left-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black ${
                  i < 3 ? "bg-[#E5484D] text-white" : "bg-white/[0.08] text-white/70"
                }`}
              >
                {i + 1}
              </span>

              <button
                type="button"
                onClick={() => navigate({ to: "/profile/$id", params: { id: s.slug } })}
                className="mx-auto block h-14 w-14 overflow-hidden rounded-full border border-[#E5484D]/60 bg-black"
              >
                {s.avatarUrl ? (
                  <img src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[13px] font-black text-white/40">
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </button>

              <div className="mt-2.5 flex items-center justify-center gap-1">
                <p className="truncate text-[13.5px] font-bold text-white">{s.name}</p>
                {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-sky-400 text-black" />}
              </div>
              <p className="line-clamp-1 text-center text-[11px] text-white/40">{s.bio || "Oventric seller"}</p>

              <div className="mt-2.5 flex items-center justify-between gap-1 rounded-xl bg-white/[0.03] px-2.5 py-2">
                <div className="text-center">
                  <p className="text-[12px] font-black text-white">{compact(s.followersCount)}</p>
                  <p className="text-[9px] uppercase tracking-wide text-white/35">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-black text-white">{s.productsCount}</p>
                  <p className="text-[9px] uppercase tracking-wide text-white/35">Products</p>
                </div>
                <div className="flex items-center gap-0.5 text-[11.5px] font-bold text-white/70">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {s.rating > 0 ? s.rating.toFixed(1) : "5.0"}
                </div>
              </div>

              <div className="mt-2.5 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleFollow(s)}
                  className={`w-full rounded-xl border py-2 text-[11.5px] font-bold transition-colors ${
                    following[s.id]
                      ? "border-transparent bg-[#E5484D] text-white"
                      : "border-[#E5484D]/40 bg-transparent text-[#E5484D]"
                  }`}
                >
                  {following[s.id] ? "Following" : "Follow"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenShop(s.slug)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[11.5px] font-bold text-white"
                >
                  View Shop
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
