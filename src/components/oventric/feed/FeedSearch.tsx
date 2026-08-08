import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Loader2, Coins, Store, User, Star } from "lucide-react";
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

const EMPTY: SearchResults = { peers: [], bounties: [], products: [] };

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 md:group-focus-within:text-emerald-600 transition-colors" />
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
              ? "rounded-full bg-[#141416] border border-white/[0.06] text-white placeholder:text-white/30 focus:border-emerald-500/50"
              : "rounded-lg bg-[#141418] md:bg-slate-100 border border-white/10 md:border-slate-200 text-slate-200 md:text-slate-900 placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
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
                  ? "bg-emerald-500 text-black font-semibold"
                  : appShell
                    ? "bg-[#141416] border border-white/[0.06] text-white/60 font-medium hover:text-white"
                    : "bg-white/[0.06] md:bg-slate-100 text-slate-300 md:text-slate-600 font-semibold hover:bg-white/10 md:hover:bg-slate-200"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>


      {typeof resultCount === "number" && (
        <p className="mt-2 text-[11px] text-slate-500 md:text-slate-500">
          {resultCount} {resultCount === 1 ? "match" : "matches"}
          {q ? ` for “${q}”` : ""}
        </p>
      )}
    </div>
  );
}

/** Cross-entity results (bounties, marketplace assets, people). */
export function FeedGlobalResults({ q, category }: { q: string; category: FeedCategory }) {
  const search = useServerFn(searchGlobal);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);

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

  const showPeople = category === "all" || category === "people";
  const showBounties = category === "all" || category === "bounties";
  const showAssets = category === "all" || category === "assets";

  const peers = showPeople ? results.peers : [];
  const bounties = showBounties ? results.bounties : [];
  const products = showAssets ? results.products : [];
  const total = peers.length + bounties.length + products.length;

  if (!enabled) {
    if (GLOBAL_CATEGORIES.includes(category)) {
      return (
        <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400 md:text-slate-600">
          Type at least 2 characters to search.
        </div>
      );
    }
    return null;
  }

  if (loading && total === 0) {
    return (
      <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-5 text-center text-sm text-slate-400 md:text-slate-600 inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
      </div>
    );
  }

  if (total === 0) {
    if (!GLOBAL_CATEGORIES.includes(category)) return null;
    return (
      <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400 md:text-slate-600">
        No matches for “{term}”.
      </div>
    );
  }

  return (
    <div className="bg-[#1E1E24] md:bg-white md:shadow-sm border border-white/10 md:border-slate-200 rounded-xl overflow-hidden">
      {peers.length > 0 && (
        <Section icon={<User className="w-3 h-3" />} title="People">
          {peers.map((p) => (
            <Link
              key={p.id}
              to="/profile/$id"
              params={{ id: p.slug }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] md:hover:bg-slate-50 transition-colors"
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white md:text-slate-900 truncate">
                  {p.name}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {p.username ? `@${p.username}` : p.slug}
                </span>
              </span>
              {p.stars > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                  <Star className="w-3 h-3" /> {p.stars.toFixed(1)}
                </span>
              )}
            </Link>
          ))}
        </Section>
      )}

      {bounties.length > 0 && (
        <Section icon={<Coins className="w-3 h-3" />} title="Bounties">
          {bounties.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => navigateSection("Bounties")}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] md:hover:bg-slate-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Coins className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white md:text-slate-900 truncate">
                  {b.title}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">
                  ${b.amountUsd.toLocaleString()}
                  {b.category ? ` · ${b.category}` : ""}
                </span>
              </span>
            </button>
          ))}
        </Section>
      )}

      {products.length > 0 && (
        <Section icon={<Store className="w-3 h-3" />} title="Marketplace assets">
          {products.map((p) => (
            <Link
              key={p.id}
              to="/product/$id"
              params={{ id: p.id }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] md:hover:bg-slate-50 transition-colors"
            >
              {p.coverUrl ? (
                <img src={p.coverUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Store className="w-3.5 h-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white md:text-slate-900 truncate">
                  {p.title}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">
                  ${p.priceUsd.toLocaleString()} · {p.category}
                  {p.vendor ? ` · ${p.vendor}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </Section>
      )}
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
