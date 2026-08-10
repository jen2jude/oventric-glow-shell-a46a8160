import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Loader2, Coins, Store, User, Star, Users, MessageSquare } from "lucide-react";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { navigateSection } from "@/components/oventric/DiscoveryPanel";
import { searchGlobal, type SearchResults } from "@/lib/search.functions";

export type FeedCategory = "all" | "posts" | "media" | "bounties" | "assets" | "people";

export const FEED_CATEGORIES: Array<{ id: FeedCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "media", label: "Photos & video" },
  { id: "bounties", label: "Bounties" },
  { id: "assets", label: "Assets" },
  { id: "people", label: "People" },
];

/** Categories that resolve against the global index rather than feed posts. */
export const GLOBAL_CATEGORIES: FeedCategory[] = ["bounties", "assets", "people"];

const EMPTY: SearchResults = { peers: [], bounties: [], products: [], circles: [], posts: [] };

export function FeedSearchBar({
  q,
  onQueryChange,
  category,
  onCategoryChange,
  resultCount,
  appShell = false,
}: {
  q: string;
  onQueryChange: (v: string) => void;
  category: FeedCategory;
  onCategoryChange: (c: FeedCategory) => void;
  resultCount?: number | null;
  /** Native app shell: chrome-less, hairline-bordered treatment. */
  appShell?: boolean;
}) {
  return (
    <div
      className={
        appShell
          ? "px-0 pt-1 pb-0"
          : "bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-3 md:p-3.5"
      }
    >
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#E5484D] md:group-focus-within:text-[#E5484D] transition-colors" />
        <input
          type="search"
          role="searchbox"
          aria-label="Search the feed, bounties and assets"
          value={q}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQueryChange("");
          }}
          placeholder={appShell ? "Search feed" : "Search posts, bounties, assets…"}
          className={`w-full h-10 pl-10 pr-9 text-sm focus:outline-none transition-all ${
            appShell
              ? "rounded-full bg-[#141416] border border-white/[0.06] text-white placeholder:text-white/30 focus:border-[#E5484D]/50"
              : "rounded-lg bg-[#141418] md:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-900 placeholder:text-slate-500 focus:border-[#E5484D]/60 focus:ring-2 focus:ring-[#E5484D]/20"
          }`}
        />
        {q && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:text-slate-200 md:hover:text-slate-900 hover:bg-white/5 md:hover:bg-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!appShell && (
        <div
          role="tablist"
          aria-label="Feed filters"
          className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1"
        >
          {FEED_CATEGORIES.map((c) => {
            const active = c.id === category;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-[#E5484D] text-black font-semibold"
                    : "bg-white/[0.06] md:bg-slate-100 text-slate-300 md:text-slate-600 font-semibold hover:bg-white/10 md:hover:bg-slate-200"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}


      {typeof resultCount === "number" && (
        <p className="mt-2 text-[11px] text-slate-500 md:text-slate-500">
          {resultCount} {resultCount === 1 ? "match" : "matches"}
          {q ? ` for “${q}”` : ""}
        </p>
      )}
    </div>
  );
}

import { PeopleExploreList } from "./PeopleExploreList";
import { ExploreHeader, type ExploreTab } from "./ExploreHeader";

/** Cross-entity results (bounties, marketplace assets, people). */
export function FeedGlobalResults({ q, category }: { q: string; category: FeedCategory }) {
  const search = useServerFn(searchGlobal);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeExploreTab, setActiveExploreTab] = useState<ExploreTab>("People");

  const term = q.trim();
  const enabled = term.length >= 2;

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    search({ data: { q: term } })
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        console.error("[FeedSearch] global search failed", e);
        if (!cancelled) setResults(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, enabled, search]);

  if (!enabled) {
    return null;
  }

  if (loading && results.peers.length === 0 && results.bounties.length === 0 && results.products.length === 0 && results.circles.length === 0 && results.posts.length === 0) {
    return (
      <div className="bg-[#0A0A0B] p-10 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#E5484D]" />
        <p className="text-sm text-white/40 font-medium">Searching Oventric...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] relative z-[42]">
      <ExploreHeader 
        activeTab={activeExploreTab} 
        onTabChange={setActiveExploreTab} 
      />

      <div className="flex-1">
        {activeExploreTab === "People" && (
          results.peers.length > 0 ? (
            <PeopleExploreList users={results.peers} />
          ) : (
            <EmptyState message="No people found" />
          )
        )}

        {activeExploreTab === "Posts" && (
          results.posts.length > 0 ? (
            <div className="space-y-4 p-4">
              {results.posts.map((p) => (
                <Link
                  key={p.id}
                  to="/post/$id"
                  params={{ id: p.id }}
                  className="block rounded-2xl border border-white/[0.06] bg-[#141416] p-4 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-[#1A1A1F]">
                      <AvatarImage src={p.authorAvatarUrl} alt={p.authorName} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white leading-none">{p.authorName}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-[14px] text-white/80 line-clamp-3 leading-relaxed">
                    {p.text}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No posts found" />
          )
        )}

        {activeExploreTab === "Products" && (
          <div className="flex flex-col divide-y divide-white/[0.06]">
            {results.products.length > 0 && (
              <div className="p-3">
                <h3 className="px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30">Marketplace</h3>
                <div className="grid grid-cols-2 gap-3">
                  {results.products.map((p) => (
                    <Link
                      key={p.id}
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141416] active:scale-[0.98]"
                    >
                      {p.coverUrl ? (
                        <img src={p.coverUrl} alt="" className="h-28 w-full object-cover" />
                      ) : (
                        <div className="h-28 w-full bg-sky-500/10" />
                      )}
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-[12.5px] font-medium text-white">{p.title}</p>
                        <p className="mt-1 text-[12.5px] font-bold text-[#E5484D]">
                          ${p.priceUsd.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {results.bounties.length > 0 && (
              <div className="p-3">
                <h3 className="px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30">Bounties</h3>
                <div className="space-y-3">
                  {results.bounties.map((b) => (
                    <Link
                      key={b.id}
                      to="/bounties"
                      className="flex items-center gap-4 p-3 rounded-2xl border border-white/[0.06] bg-[#141416] active:scale-[0.98]"
                    >
                      {b.coverUrl ? (
                        <img src={b.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <Coins className="w-6 h-6 text-amber-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-bold text-white truncate">{b.title}</h4>
                        <p className="text-[12px] text-[#E5484D] font-bold mt-0.5">
                          ${b.amountUsd.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {results.products.length === 0 && results.bounties.length === 0 && (
              <EmptyState message="No products or bounties found" />
            )}
          </div>
        )}

        {activeExploreTab === "Topics" && (
          results.circles.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 p-4">
              {results.circles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigateSection("Circles")}
                  className="flex items-center gap-3 w-full rounded-2xl border border-white/[0.06] bg-[#141416] p-4 text-left active:scale-[0.98]"
                >
                  <span className="text-3xl">{c.emoji}</span>
                  <div>
                    <p className="text-[15px] font-bold text-white">{c.name}</p>
                    <p className="text-[12px] text-white/40">{c.memberCount} members</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState message="No topics found" />
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center">
      <p className="text-sm font-medium text-white/30">{message}</p>
    </div>
  );
}


function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.06] md:border-slate-100 last:border-b-0">
      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
        {icon} {title}
      </div>
      <div className="pb-1">{children}</div>
    </div>
  );
}
