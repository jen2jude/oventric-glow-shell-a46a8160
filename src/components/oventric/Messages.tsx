import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Code2,
  Star,
  ExternalLink,
  MoreVertical,
  Flag,
  UserMinus,
  X,
  Shield,
  Wallet,
  MessageSquare,
} from "lucide-react";
import {
  filterThreads,
  mockThreads,
  type ChatMessage,
  type ChatThread,
  type ThreadFilter,
} from "@/lib/messaging/mockThreads";

interface MessagesProps {
  /** compact = drawer variant, page = full-screen route variant */
  variant?: "page" | "compact";
  initialThreadId?: string;
  onOpenEscrow?: (bountyId: string) => void;
  onClose?: () => void;
}

interface PendingAttachment {
  id: string;
  name: string;
  kind: "image" | "file";
}

const FILTER_LABELS: { id: ThreadFilter; label: string }[] = [
  { id: "all", label: "All Chats" },
  { id: "circle", label: "Circle Peers" },
  { id: "bounty", label: "Bounty Contracts" },
];

function CircleVerifiedIcon({ className = "" }: { className?: string }) {
  return (
    <span
      title="Verified circle peer"
      className={`inline-flex items-center ${className}`}
      aria-label="Verified circle peer"
    >
      <svg viewBox="0 0 24 12" className="w-5 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="7" cy="6" r="4.5" />
        <circle cx="15" cy="6" r="4.5" />
      </svg>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 relative w-24 h-24">
          <div className="absolute inset-0 rounded-full rgb-pulse-glow bg-[#1E1E24] border border-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-emerald-400" />
          </div>
        </div>
        <div className="text-white font-black text-lg">Secure channel idle</div>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          Select a peer or open a project contract to initialize secure communication.
        </p>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: ChatThread;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg border transition-colors ${
        active
          ? "bg-emerald-500/10 border-emerald-500/40"
          : thread.unread
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
        {thread.online && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#1E1E24] shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">{thread.peerName}</span>
          {thread.inCircle && <CircleVerifiedIcon />}
          <span className="ml-auto shrink-0 text-[10px] text-slate-500">{thread.lastActive}</span>
        </div>
        <div className="text-xs text-slate-400 truncate mt-0.5">{thread.preview}</div>
        {thread.bounty && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded px-1.5 py-0.5">
            <Shield className="w-2.5 h-2.5" /> Escrow ${thread.bounty.escrowUsd}
          </div>
        )}
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.from === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm text-white ${
          mine
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400/60"
            : "bg-[#2A2A32] border border-white/5"
        }`}
      >
        {msg.text && <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>}
        {msg.code && (
          <pre
            className={`mt-1 overflow-x-auto rounded-lg border ${
              mine ? "border-black/30 bg-black/40" : "border-white/10 bg-black/50"
            } p-2.5 text-[11px] font-mono leading-snug text-emerald-200`}
          >
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">{msg.code.language}</div>
            {msg.code.body}
          </pre>
        )}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.attachments.map((a) => (
              <span
                key={a.name}
                className="inline-flex items-center gap-1 text-[11px] rounded-md bg-black/30 border border-white/10 px-1.5 py-1"
              >
                {a.kind === "image" ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                {a.name}
              </span>
            ))}
          </div>
        )}
        <div className={`text-[10px] mt-1 ${mine ? "text-emerald-100/80" : "text-slate-500"}`}>{msg.time}</div>
      </div>
    </div>
  );
}

export function Messages({ variant = "page", initialThreadId, onOpenEscrow, onClose }: MessagesProps) {
  const [threads, setThreads] = useState<ChatThread[]>(mockThreads);
  const [activeId, setActiveId] = useState<string | null>(initialThreadId ?? null);
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeLang, setCodeLang] = useState("ts");
  const [codeBody, setCodeBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showListOnMobile, setShowListOnMobile] = useState(!initialThreadId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleThreads = useMemo(() => filterThreads(threads, filter, query), [threads, filter, query]);
  const active = threads.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeId, active?.messages.length]);

  const selectThread = (id: string) => {
    setActiveId(id);
    setShowListOnMobile(false);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
  };

  const send = () => {
    if (!active) return;
    const hasText = draft.trim().length > 0;
    const hasCode = codeOpen && codeBody.trim().length > 0;
    const hasAttach = pending.length > 0;
    if (!hasText && !hasCode && !hasAttach) return;
    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      from: "me",
      text: hasText ? draft.trim() : undefined,
      code: hasCode ? { language: codeLang, body: codeBody } : undefined,
      attachments: hasAttach ? pending.map((p) => ({ name: p.name, kind: p.kind })) : undefined,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? { ...t, messages: [...t.messages, msg], preview: msg.text ?? msg.code?.body.slice(0, 60) ?? "Attachment", lastActive: "now" }
          : t,
      ),
    );
    setDraft("");
    setCodeBody("");
    setCodeOpen(false);
    setPending([]);
  };

  const addMockAttachment = (kind: "image" | "file") => {
    const nameBase = kind === "image" ? "screenshot" : "notes";
    const ext = kind === "image" ? "png" : "pdf";
    setPending((p) => [...p, { id: `${Date.now()}-${p.length}`, name: `${nameBase}-${p.length + 1}.${ext}`, kind }]);
  };

  const wrapperClasses =
    variant === "compact"
      ? "flex h-full bg-[#121214] text-slate-200"
      : "flex h-full bg-[#121214] text-slate-200";

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
                placeholder="Search peers or bounties…"
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
          <div className="flex items-center gap-1">
            {FILTER_LABELS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  filter === f.id
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 border border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {visibleThreads.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">No conversations match.</div>
          ) : (
            visibleThreads.map((t) => (
              <ThreadRow key={t.id} thread={t} active={t.id === activeId} onClick={() => selectThread(t.id)} />
            ))
          )}
        </div>
      </aside>

      {/* RIGHT — Active Chat */}
      <section
        className={`${showListOnMobile ? "hidden" : "flex"} md:flex flex-1 min-w-0 flex-col bg-[#121214]`}
      >
        {!active ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#16161B]">
              <button
                onClick={() => setShowListOnMobile(true)}
                className="md:hidden text-slate-400 hover:text-white text-xs font-semibold"
              >
                ← Back
              </button>
              <div className="relative shrink-0">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${active.peerGradient} flex items-center justify-center text-white font-bold text-xs`}
                >
                  {active.peerInitials}
                </div>
                {active.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#16161B]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-semibold text-sm truncate">{active.peerName}</span>
                  {active.inCircle && <CircleVerifiedIcon />}
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-yellow-300 ml-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {active.peerRating.toFixed(1)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{active.peerRole} · {active.online ? "Online now" : `active ${active.lastActive}`}</div>
              </div>
              <Link
                to="/profile/$id"
                params={{ id: active.peerId }}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-md px-2 py-1"
              >
                <ExternalLink className="w-3 h-3" /> Profile
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Thread options"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-white/10 bg-[#1E1E24] shadow-xl z-20 py-1"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
                      <Flag className="w-3.5 h-3.5" /> Report peer
                    </button>
                    <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">
                      <UserMinus className="w-3.5 h-3.5" /> Leave circle
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Bounty banner */}
            {active.bounty && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-emerald-500/20 bg-emerald-500/5">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">Active bounty contract</div>
                  <div className="text-xs text-slate-200 truncate">{active.bounty.title}</div>
                </div>
                <div className="text-xs text-emerald-300 font-black tabular-nums">${active.bounty.escrowUsd.toLocaleString()}</div>
                <button
                  onClick={() => onOpenEscrow?.(active.bounty!.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 px-2 py-1"
                >
                  <Wallet className="w-3 h-3" /> Escrow matrix
                </button>
              </div>
            )}

            {/* Message stream */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {active.messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 bg-[#16161B] p-3 space-y-2">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#1E1E24] px-2 py-1 text-[11px] text-slate-200"
                    >
                      {p.kind === "image" ? (
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-emerald-500/40 to-emerald-700/40 flex items-center justify-center">
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-300" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#2A2A32] flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-slate-300" />
                        </div>
                      )}
                      <span className="truncate max-w-[120px]">{p.name}</span>
                      <button
                        onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-slate-500 hover:text-red-400"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {codeOpen && (
                <div className="rounded-lg border border-emerald-500/30 bg-black/40 p-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                    <input
                      value={codeLang}
                      onChange={(e) => setCodeLang(e.target.value)}
                      className="bg-transparent text-[11px] text-emerald-300 font-mono focus:outline-none w-20"
                      placeholder="lang"
                    />
                    <button
                      onClick={() => {
                        setCodeOpen(false);
                        setCodeBody("");
                      }}
                      className="ml-auto text-slate-500 hover:text-white"
                      aria-label="Close code block"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={codeBody}
                    onChange={(e) => setCodeBody(e.target.value)}
                    rows={4}
                    placeholder="Paste a clean code snippet — it will format inside the message."
                    className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-[11px] font-mono text-emerald-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => addMockAttachment("image")}
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-white/5"
                    aria-label="Attach image"
                    title="Attach image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => addMockAttachment("file")}
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-white/5"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCodeOpen((v) => !v)}
                    aria-label="Attach code block"
                    title="Code snippet"
                    className={`p-2 rounded-lg transition-colors ${
                      codeOpen
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                        : "text-slate-400 hover:text-emerald-300 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <Code2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Type a secure message, attach a code block, or drop a repository link…"
                  className="flex-1 resize-none max-h-32 min-h-[40px] bg-[#1E1E24] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() && !codeBody.trim() && pending.length === 0}
                  className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
