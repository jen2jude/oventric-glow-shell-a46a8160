import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Send,
  Star,
  ExternalLink,
  X,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/lib/auth-gate/AuthGateProvider";
import {
  listThreads,
  listMessages,
  sendMessage,
  markThreadRead,
  type ThreadSummary,
  type DMRow,
} from "@/lib/messaging/messages.functions";

interface MessagesProps {
  variant?: "page" | "compact";
  initialThreadId?: string; // treated as peerId
  onOpenEscrow?: (bountyId: string) => void;
  onClose?: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dayMs = 86400000;
  if (now.getTime() - d.getTime() < 7 * dayMs)
    return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString();
}

function relative(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function EmptyChat({ hasThreads }: { hasThreads: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 relative w-24 h-24">
          <div className="absolute inset-0 rounded-full rgb-pulse-glow bg-[#1E1E24] border border-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-emerald-400" />
          </div>
        </div>
        <div className="text-white font-black text-lg">
          {hasThreads ? "Select a conversation" : "No conversations yet"}
        </div>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          {hasThreads
            ? "Pick a peer on the left to open the encrypted stream."
            : "Message a peer from their profile or a bounty thread to start."}
        </p>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  online,
  onClick,
}: {
  thread: ThreadSummary;
  active: boolean;
  online: boolean;
  onClick: () => void;
}) {
  const unread = thread.unread > 0;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg border transition-colors ${
        active
          ? "bg-emerald-500/10 border-emerald-500/40"
          : unread
            ? "rgb-pulse-glow bg-[#1E1E24] border-white/10 hover:bg-white/5"
            : "bg-[#1E1E24] border-white/10 hover:bg-white/5"
      }`}
    >
      <div className="relative shrink-0">
        <div
          className={`w-10 h-10 rounded-full bg-gradient-to-br ${thread.peerGradient} flex items-center justify-center text-white font-bold text-xs`}
        >
          {thread.peerInitials}
        </div>
        {online && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#16161B] shadow-[0_0_6px_rgba(52,211,153,0.9)]"
            title="Online"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">{thread.peerName}</span>
          <span className="ml-auto shrink-0 text-[10px] text-slate-500">{formatTime(thread.lastAt)}</span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <div className="text-xs text-slate-400 truncate flex-1">{thread.preview}</div>
          {unread && (
            <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-black text-[10px] font-black">
              {thread.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg, mine }: { msg: DMRow; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm text-white ${
          mine
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400/60"
            : "bg-[#2A2A32] border border-white/5"
        }`}
      >
        {msg.body && <div className="leading-relaxed whitespace-pre-wrap break-words">{msg.body}</div>}
        {msg.media_path && (
          <div className="mt-1 text-[11px] italic opacity-80">📎 attachment</div>
        )}
        <div className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? "text-emerald-100/80 justify-end" : "text-slate-500"}`}>
          <span>{formatTime(msg.created_at)}</span>
          {mine && !msg.id.startsWith("tmp-") && (
            <span
              className={msg.read_at ? "text-sky-200" : "text-emerald-100/60"}
              title={msg.read_at ? `Read ${formatTime(msg.read_at)}` : "Sent"}
              aria-label={msg.read_at ? "Read" : "Sent"}
            >
              {msg.read_at ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Messages({ variant = "page", initialThreadId, onOpenEscrow: _onOpenEscrow, onClose }: MessagesProps) {
  const { session, openGate } = useAuthGate();
  const me = session?.user?.id ?? null;

  const fetchThreads = useServerFn(listThreads);
  const fetchMessages = useServerFn(listMessages);
  const postMessage = useServerFn(sendMessage);
  const markRead = useServerFn(markThreadRead);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [activePeer, setActivePeer] = useState<string | null>(initialThreadId ?? null);
  const [messages, setMessages] = useState<DMRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const PAGE_SIZE = 30;
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showListOnMobile, setShowListOnMobile] = useState(!initialThreadId);
  const [onlinePeers, setOnlinePeers] = useState<
    Map<string, { name: string; slug: string; initials: string; gradient: string }>
  >(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);


  const activeThread = useMemo(
    () => threads.find((t) => t.peerId === activePeer) ?? null,
    [threads, activePeer],
  );

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.peerName.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q),
    );
  }, [threads, query]);

  const reloadThreads = useCallback(async () => {
    if (!me) {
      setThreads([]);
      return;
    }
    setLoadingThreads(true);
    try {
      const rows = await fetchThreads();
      setThreads(rows);
    } catch (e) {
      console.error("threads load failed", e);
    } finally {
      setLoadingThreads(false);
    }
  }, [me, fetchThreads]);

  useEffect(() => {
    void reloadThreads();
  }, [reloadThreads]);

  // Realtime presence — instantly reflects who is online / goes offline.
  useEffect(() => {
    if (!me) {
      setOnlinePeers(new Map());
      return;
    }
    let cancelled = false;
    const channel = supabase.channel("oventric:presence", {
      config: { presence: { key: me } },
    });

    const GRADS = [
      "from-purple-500 to-pink-500",
      "from-emerald-400 to-teal-500",
      "from-sky-400 to-indigo-500",
      "from-amber-400 to-orange-500",
      "from-fuchsia-500 to-pink-500",
      "from-rose-400 to-red-500",
      "from-cyan-400 to-blue-500",
      "from-lime-400 to-emerald-500",
    ];
    const gradFor = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      return GRADS[h % GRADS.length];
    };
    const initialsFor = (name: string) => {
      const parts = name.trim().split(/\s+/).slice(0, 2);
      return parts.map((s) => s[0]?.toUpperCase() ?? "").join("") || "??";
    };

    const syncFromState = () => {
      if (cancelled) return;
      const state = channel.presenceState<{ user_id: string; name?: string; slug?: string }>();
      const next = new Map<string, { name: string; slug: string; initials: string; gradient: string }>();
      for (const key of Object.keys(state)) {
        if (key === me) continue;
        const meta = state[key][0];
        const name = meta?.name || "Peer";
        next.set(key, {
          name,
          slug: meta?.slug || key,
          initials: initialsFor(name),
          gradient: gradFor(key),
        });
      }
      setOnlinePeers(next);
    };

    channel
      .on("presence", { event: "sync" }, syncFromState)
      .on("presence", { event: "join" }, syncFromState)
      .on("presence", { event: "leave" }, syncFromState)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || cancelled) return;
        // Load own profile to publish minimal metadata.
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name, username, slug")
          .eq("user_id", me)
          .maybeSingle();
        if (cancelled) return;
        const name = p?.display_name || p?.username || "Peer";
        await channel.track({ user_id: me, name, slug: p?.slug || me, online_at: new Date().toISOString() });
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me]);


  // Sync activePeer when initialThreadId changes (e.g., opening chat from a new profile)
  useEffect(() => {
    if (initialThreadId) {
      setActivePeer(initialThreadId);
      setShowListOnMobile(false);
    }
  }, [initialThreadId]);

  // If we have an activePeer but no matching thread yet (first-time chat opened
  // from a profile), synthesize a thread entry from the peer's profile so the
  // chat view opens immediately instead of showing "Select a conversation".
  useEffect(() => {
    if (!me || !activePeer) return;
    if (threads.some((t) => t.peerId === activePeer)) return;
    let cancel = false;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, slug")
        .eq("user_id", activePeer)
        .maybeSingle();
      if (cancel || !p) return;
      const name = (p.display_name as string) || (p.username as string) || "Peer";
      const parts = name.trim().split(/\s+/).slice(0, 2);
      const initials = parts.map((s) => s[0]?.toUpperCase() ?? "").join("") || "??";
      const GRADS = [
        "from-purple-500 to-pink-500",
        "from-emerald-400 to-teal-500",
        "from-sky-400 to-indigo-500",
        "from-amber-400 to-orange-500",
        "from-fuchsia-500 to-pink-500",
        "from-rose-400 to-red-500",
        "from-cyan-400 to-blue-500",
        "from-lime-400 to-emerald-500",
      ];
      let h = 0;
      for (let i = 0; i < activePeer.length; i++) h = (h * 31 + activePeer.charCodeAt(i)) >>> 0;
      const gradient = GRADS[h % GRADS.length];
      setThreads((prev) =>
        prev.some((t) => t.peerId === activePeer)
          ? prev
          : [
              {
                peerId: activePeer,
                peerName: name,
                peerSlug: (p.slug as string) ?? activePeer,
                peerInitials: initials,
                peerGradient: gradient,
                preview: "New conversation",
                lastAt: new Date().toISOString(),
                unread: 0,
              },
              ...prev,
            ],
      );
    })();
    return () => {
      cancel = true;
    };
  }, [me, activePeer, threads]);


  // Load latest page of messages for active peer
  useEffect(() => {
    if (!me || !activePeer) {
      setMessages([]);
      setHasMoreOlder(false);
      return;
    }
    let cancel = false;
    setLoadingMessages(true);
    fetchMessages({ data: { peerId: activePeer, limit: PAGE_SIZE } })
      .then((page) => {
        if (cancel) return;
        setMessages(page.rows);
        setHasMoreOlder(page.hasMore);
      })
      .catch((e) => console.error("messages load failed", e))
      .finally(() => {
        if (!cancel) setLoadingMessages(false);
      });
    // Mark thread read
    markRead({ data: { peerId: activePeer } })
      .then(() => {
        setThreads((prev) => prev.map((t) => (t.peerId === activePeer ? { ...t, unread: 0 } : t)));
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [me, activePeer, fetchMessages, markRead]);

  const loadOlder = useCallback(async () => {
    if (!activePeer || loadingOlder || !hasMoreOlder) return;
    const oldest = messages[0];
    if (!oldest) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages({
        data: { peerId: activePeer, limit: PAGE_SIZE, before: oldest.created_at },
      });
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...page.rows.filter((r) => !seen.has(r.id)), ...prev];
        return merged;
      });
      setHasMoreOlder(page.hasMore);
      // Preserve scroll position after prepending
      requestAnimationFrame(() => {
        const nextEl = scrollRef.current;
        if (nextEl) nextEl.scrollTop = nextEl.scrollHeight - prevHeight + prevTop;
      });
    } catch (e) {
      console.error("load older failed", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [activePeer, loadingOlder, hasMoreOlder, messages, fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`dm-${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${me}` },
        (payload) => {
          const row = payload.new as DMRow;
          if (row.sender_id === activePeer) {
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
            markRead({ data: { peerId: row.sender_id } }).catch(() => {});
          }
          void reloadThreads();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${me}` },
        (payload) => {
          const row = payload.new as DMRow;
          if (row.recipient_id === activePeer) {
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          }
          void reloadThreads();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `sender_id=eq.${me}` },
        (payload) => {
          const row = payload.new as DMRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, read_at: row.read_at } : m)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, activePeer, reloadThreads, markRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activePeer, messages.length]);

  const selectThread = (peerId: string) => {
    setActivePeer(peerId);
    setShowListOnMobile(false);
  };

  const send = async () => {
    if (!activePeer) return;
    const body = draft.trim();
    if (!body) return;
    if (!me) {
      openGate("interaction");
      return;
    }
    setSending(true);
    const optimistic: DMRow = {
      id: `tmp-${Date.now()}`,
      sender_id: me,
      recipient_id: activePeer,
      body,
      media_path: null,
      media_type: null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const row = await postMessage({ data: { recipientId: activePeer, body } });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? row : m)));
      void reloadThreads();
    } catch (e) {
      console.error("send failed", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const wrapperClasses = "flex h-full bg-[#121214] text-slate-200";

  if (!me) {
    return (
      <div className={wrapperClasses}>
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-[#1E1E24] border border-white/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-white font-black text-lg">Sign in to open Messages</div>
            <p className="text-sm text-slate-400 mt-2">
              Direct messages are encrypted between verified peers. Connect your account to start chatting.
            </p>
            <button
              onClick={() => openGate("interaction")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm"
            >
              Connect account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      {/* LEFT — Thread Navigator */}
      <aside
        className={`${
          showListOnMobile ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-[30%] md:min-w-[280px] md:max-w-[380px] border-r border-white/10 bg-[#16161B]`}
      >
        <div className="sticky top-0 z-10 bg-[#16161B] border-b border-white/10 px-3 py-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search peers…"
                className="w-full h-9 pl-9 pr-3 bg-[#1E1E24] border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            {variant === "compact" && onClose && (
              <button
                onClick={onClose}
                aria-label="Close messages"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {(() => {
          const threadIds = new Set(threads.map((t) => t.peerId));
          const rail = [...onlinePeers.entries()].filter(([id]) => !threadIds.has(id));
          if (rail.length === 0) return null;
          return (
            <div className="border-b border-white/10 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-widest font-black text-emerald-400 mb-2">
                Online now · {rail.length}
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {rail.map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => selectThread(id)}
                    title={p.name}
                    className="group shrink-0 flex flex-col items-center gap-1 w-14"
                  >
                    <div className="relative">
                      <div
                        className={`w-11 h-11 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white font-bold text-xs ring-2 ring-transparent group-hover:ring-emerald-400/60 transition`}
                      >
                        {p.initials}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#16161B] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                    </div>
                    <span className="text-[10px] text-slate-300 truncate max-w-full">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loadingThreads && threads.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading conversations…
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">
              {threads.length === 0 ? "No conversations yet." : "No conversations match."}
            </div>
          ) : (
            visibleThreads.map((t) => (
              <ThreadRow
                key={t.peerId}
                thread={t}
                active={t.peerId === activePeer}
                online={onlinePeers.has(t.peerId)}
                onClick={() => selectThread(t.peerId)}
              />
            ))
          )}
        </div>

      </aside>

      {/* RIGHT — Active Chat */}
      <section
        className={`${showListOnMobile ? "hidden" : "flex"} md:flex flex-1 min-w-0 flex-col bg-[#121214]`}
      >
        {!activeThread ? (
          <EmptyChat hasThreads={threads.length > 0} />
        ) : (
          <>
            <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#16161B]">
              <button
                onClick={() => setShowListOnMobile(true)}
                className="md:hidden text-slate-400 hover:text-white text-xs font-semibold"
              >
                ← Back
              </button>
              <div className="relative shrink-0">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${activeThread.peerGradient} flex items-center justify-center text-white font-bold text-xs`}
                >
                  {activeThread.peerInitials}
                </div>
                {onlinePeers.has(activeThread.peerId) && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#16161B] shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                    title="Online"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-semibold text-sm truncate">{activeThread.peerName}</span>
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 ml-1">
                    <Star className="w-3 h-3" />
                    peer
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {onlinePeers.has(activeThread.peerId) ? (
                    <span className="text-emerald-400 font-semibold">● Online now</span>
                  ) : (
                    <>last active {relative(activeThread.lastAt)}</>
                  )}
                </div>
              </div>

              <Link
                to="/profile/$id"
                params={{ id: activeThread.peerSlug }}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-md px-2 py-1"
              >
                <ExternalLink className="w-3 h-3" /> Profile
              </Link>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMessages ? (
                <div className="text-xs text-slate-500 text-center py-8 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-8">
                  No messages yet — say hello.
                </div>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} msg={m} mine={m.sender_id === me} />)
              )}
            </div>

            <div className="border-t border-white/10 bg-[#16161B] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Type a message…"
                  className="flex-1 resize-none max-h-32 min-h-[40px] bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
