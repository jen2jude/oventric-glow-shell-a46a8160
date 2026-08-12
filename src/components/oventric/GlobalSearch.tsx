import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Star, Coins, Store, User, Loader2, Users, MessageSquare } from "lucide-react";
import { navigateSection } from "@/components/oventric/DiscoveryPanel";
import { searchGlobal, type SearchResults } from "@/lib/search.functions";

interface GlobalSearchProps {
  variant?: "inline" | "sheet";
  light?: boolean;
  onClose?: () => void;
  autoFocus?: boolean;
}

const EMPTY: SearchResults = { peers: [], bounties: [], products: [], circles: [], posts: [], shops: [], services: [], courses: [] };

export function GlobalSearch({
  variant = "inline",
  onClose,
  autoFocus,
  light = false,
}: GlobalSearchProps) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const search = useServerFn(searchGlobal);

  // Debounce input to keep search calls under control.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    if (debounced.length < 1) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    search({ data: { q: debounced } })
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        console.error("[GlobalSearch] search failed", e);
        if (!cancelled) setResults(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, search]);

  const enabled = debounced.length >= 1;

  const flat = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      sub: string;
      icon: React.ReactNode;
      onSelect: () => void;
      trailing?: React.ReactNode;
      trailingLabel?: string;
    }> = [];
    results.peers.forEach((p) =>
      items.push({
        key: `peer-${p.id}`,
        label: p.name,
        sub: p.username ? `@${p.username}` : p.slug,
        icon: p.avatarUrl ? (
          <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
        ),
        trailing: <Star className="w-3 h-3 text-amber-400" />,
        trailingLabel: p.stars ? p.stars.toFixed(1) : undefined,
        onSelect: () => navigate({ to: "/profile/$id", params: { id: p.slug } }),
      }),
    );
    results.bounties.forEach((b) =>
      items.push({
        key: `bounty-${b.id}`,
        label: b.title,
        sub: `$${b.amountUsd.toLocaleString()}${b.category ? ` · ${b.category}` : ""}`,
        icon: (
          <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center">
            <Coins className="w-3.5 h-3.5" />
          </div>
        ),
        onSelect: () => navigateSection("Bounties"),
      }),
    );
    results.products.forEach((p) =>
      items.push({
        key: `product-${p.id}`,
        label: p.title,
        sub: `$${p.priceUsd.toLocaleString()} · ${p.category}${p.vendor ? ` · ${p.vendor}` : ""}`,
        icon: p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="w-7 h-7 rounded-md object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-sky-500/20 text-sky-300 flex items-center justify-center">
            <Store className="w-3.5 h-3.5" />
          </div>
        ),
        onSelect: () => navigate({ to: "/product/$id", params: { id: p.id } }),
      }),
    );
    results.circles.forEach((c) =>
      items.push({
        key: `circle-${c.id}`,
        label: c.name,
        sub: `${c.emoji} ${c.memberCount} members`,
        icon: (
          <div className="w-7 h-7 rounded-md bg-violet-500/20 text-violet-300 flex items-center justify-center">
            <Users className="w-3.5 h-3.5" />
          </div>
        ),
        onSelect: () => navigateSection("Circles"),
      }),
    );
    results.posts.forEach((p) =>
      items.push({
        key: `post-${p.id}`,
        label: p.authorName,
        sub: p.text,
        icon: p.authorAvatarUrl ? (
          <img src={p.authorAvatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-500/20 text-slate-300 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
        ),
        onSelect: () => navigate({ to: "/post/$id", params: { id: p.id } }),
      }),
    );
    return items;
  }, [results, navigate]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (variant !== "inline") return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [variant]);

  const showResults = enabled && (variant === "sheet" || open);
  const empty = enabled && !loading && flat.length === 0;
  const listMaxH = variant === "sheet" ? "max-h-[70vh]" : "max-h-96";

  const handleSelect = (fn: () => void) => {
    fn();
    setOpen(false);
    setQ("");
    onClose?.();
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label="Search creators, bounties and assets"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              onClose?.();
            }
            if (e.key === "Enter" && flat[0]) handleSelect(flat[0].onSelect);
          }}
          placeholder="Search creators, bounties, assets…"
          className={`w-full h-10 pl-10 pr-9 rounded-lg text-sm ${light ? "bg-slate-100 border border-slate-200 text-slate-900 placeholder:text-slate-500" : "bg-[#1E1E24] border border-white/10 text-slate-200 placeholder:text-slate-500"} focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all`}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showResults && (
        <div
          role="listbox"
          className={`${variant === "sheet" ? "mt-3" : "absolute left-0 right-0 mt-2 z-50"} bg-[#141418] border border-white/10 rounded-xl shadow-2xl overflow-hidden`}
        >
          {loading && flat.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-400 text-sm inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          ) : empty ? (
            <div className="px-4 py-6 text-center text-slate-400 text-sm">
              No matches for “{debounced}”.
            </div>
          ) : (
            <ul className={`${listMaxH} overflow-y-auto py-1`}>
              {results.peers.length > 0 && (
                <li className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Peers
                </li>
              )}
              {flat
                .filter((f) => f.key.startsWith("peer-"))
                .map((item) => (
                  <ResultRow
                    key={item.key}
                    item={item}
                    onSelect={handleSelect}
                    trailing={item.trailing}
                    trailingLabel={item.trailingLabel}
                  />
                ))}
              {results.bounties.length > 0 && (
                <li className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Coins className="w-3 h-3" /> Bounties
                </li>
              )}
              {flat
                .filter((f) => f.key.startsWith("bounty-"))
                .map((item) => (
                  <ResultRow key={item.key} item={item} onSelect={handleSelect} />
                ))}
              {results.circles.length > 0 && (
                <li className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Communities
                </li>
              )}
              {flat
                .filter((f) => f.key.startsWith("circle-"))
                .map((item) => (
                  <ResultRow key={item.key} item={item} onSelect={handleSelect} />
                ))}

              {results.posts.length > 0 && (
                <li className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Posts
                </li>
              )}
              {flat
                .filter((f) => f.key.startsWith("post-"))
                .map((item) => (
                  <ResultRow key={item.key} item={item} onSelect={handleSelect} />
                ))}

              {results.products.length > 0 && (
                <li className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Store className="w-3 h-3" /> Marketplace
                </li>
              )}
              {flat
                .filter((f) => f.key.startsWith("product-"))
                .map((item) => (
                  <ResultRow key={item.key} item={item} onSelect={handleSelect} />
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  item,
  onSelect,
  trailing,
  trailingLabel,
}: {
  item: { label: string; sub?: string; icon: React.ReactNode; onSelect: () => void };
  onSelect: (fn: () => void) => void;
  trailing?: React.ReactNode;
  trailingLabel?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.onSelect)}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-left"
      >
        {item.icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-100 truncate">{item.label}</div>
          {item.sub && <div className="text-xs text-slate-500 truncate">{item.sub}</div>}
        </div>
        {trailing && (
          <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
            {trailing}
            {trailingLabel}
          </div>
        )}
      </button>
    </li>
  );
}
