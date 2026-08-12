import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Users, Loader2, UserPlus, Inbox, RefreshCw } from "lucide-react";
import {
  acceptIncomingRequest,
  declineIncomingRequest,
  ensureMyProfile,
  listIncomingCircleRequests,
  type IncomingCircleRequest,
} from "@/lib/circles.functions";
import { supabase } from "@/integrations/supabase/client";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initialsFrom(label: string) {
  return (
    label
      .split(/[\s-]+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??"
  );
}

export function CircleRequestsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [requests, setRequests] = useState<IncomingCircleRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const list = useServerFn(listIncomingCircleRequests);
  const accept = useServerFn(acceptIncomingRequest);
  const decline = useServerFn(declineIncomingRequest);
  const ensure = useServerFn(ensureMyProfile);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await list();
      setRequests(rows);
    } catch (e) {
      console.error("[CircleRequestsDrawer] refresh failed", e);
      setError("Couldn't load requests. Try again.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!signedIn) {
      setRequests([]);
      return;
    }
    (async () => {
      try {
        await ensure();
      } catch (e) {
        console.error("[CircleRequestsDrawer] ensure profile failed", e);
      }
      refresh();
    })();
  }, [open, signedIn, ensure, refresh]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleAccept = async (r: IncomingCircleRequest) => {
    setBusyId(r.requesterId);
    setError(null);
    try {
      await accept({ data: { requesterId: r.requesterId } });
      setRequests((prev) => prev.filter((x) => x.requesterId !== r.requesterId));
    } catch (e) {
      console.error("[CircleRequestsDrawer] accept failed", e);
      setError("Couldn't accept — try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (r: IncomingCircleRequest) => {
    setBusyId(r.requesterId);
    setError(null);
    try {
      await decline({ data: { requesterId: r.requesterId } });
      setRequests((prev) => prev.filter((x) => x.requesterId !== r.requesterId));
    } catch (e) {
      console.error("[CircleRequestsDrawer] decline failed", e);
      setError("Couldn't reject — try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  const count = requests.length;

  return (
    <div className="modal-light fixed inset-0 z-[60] flex justify-end">
      <button aria-label="Close circle requests" onClick={onClose} className="flex-1 bg-black" />
      <aside className="w-full sm:w-[420px] max-w-full bg-[#1E1E24] border-l border-white/10 flex flex-col shadow-2xl">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-300 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm truncate">Circle Requests</div>
            <div className="text-[11px] text-slate-500">
              {loading ? "Loading…" : `${count} pending`}
            </div>
          </div>
          <button
            onClick={refresh}
            aria-label="Refresh"
            disabled={loading}
            className="p-1.5 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {error && (
          <div className="mx-4 mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-[10px] px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!signedIn ? (
            <EmptyState
              icon={<UserPlus className="w-6 h-6 text-slate-400" />}
              title="Sign in to see requests"
              body="Circle requests are private to your account. Sign in to review who wants to join your circle."
            />
          ) : loading && count === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading requests…
            </div>
          ) : count === 0 ? (
            <EmptyState
              icon={<Inbox className="w-6 h-6 text-slate-400" />}
              title="No pending requests"
              body="When someone asks to join your circle, they'll show up here."
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {requests.map((r) => {
                const busy = busyId === r.requesterId;
                const label = r.requesterName || r.requesterSlug || "Unknown user";
                const initials = initialsFrom(label);
                return (
                  <li key={r.requesterId} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center text-black font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      {r.requesterSlug ? (
                        <Link
                          to="/profile/$id"
                          params={{ id: r.requesterSlug }}
                          onClick={onClose}
                          className="text-sm font-semibold text-white hover:text-emerald-300 truncate block"
                        >
                          {label}
                        </Link>
                      ) : (
                        <div className="text-sm font-semibold text-white truncate">{label}</div>
                      )}
                      <div className="text-[11px] text-slate-500">
                        Wants to join your circle · {relativeTime(r.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAccept(r)}
                        disabled={busy}
                        aria-label={`Accept request from ${label}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Accept</span>
                      </button>
                      <button
                        onClick={() => handleDecline(r)}
                        disabled={busy}
                        aria-label={`Reject request from ${label}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border border-white/10 text-slate-300 hover:text-red-300 hover:bg-red-500/10 text-xs font-semibold disabled:opacity-40"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reject</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-500">
          Only you can see this list. Accepting adds them to your circle.
        </footer>
      </aside>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 grid place-items-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{body}</p>
    </div>
  );
}
