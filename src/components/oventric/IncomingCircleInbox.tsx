import { useCallback, useEffect, useRef, useState } from "react";
import { UserPlus, Check, X, Users, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
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

export function IncomingCircleInbox() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<IncomingCircleRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      console.error("[IncomingCircleInbox] refresh failed", e);
      setError("Couldn't load requests");
    } finally {
      setLoading(false);
    }
  }, [list]);

  // Track auth session so we only mount for signed-in users.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Provision profile + initial load on sign-in.
  useEffect(() => {
    if (!signedIn) {
      setRequests([]);
      return;
    }
    (async () => {
      try {
        await ensure();
      } catch (e) {
        console.error("[IncomingCircleInbox] ensure profile failed", e);
      }
      refresh();
    })();
  }, [signedIn, ensure, refresh]);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open, refresh]);

  const handleAccept = async (r: IncomingCircleRequest) => {
    setBusyId(r.requesterId);
    try {
      await accept({ data: { requesterId: r.requesterId } });
      setRequests((prev) => prev.filter((x) => x.requesterId !== r.requesterId));
    } catch (e) {
      console.error("[IncomingCircleInbox] accept failed", e);
      setError("Couldn't accept — try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (r: IncomingCircleRequest) => {
    setBusyId(r.requesterId);
    try {
      await decline({ data: { requesterId: r.requesterId } });
      setRequests((prev) => prev.filter((x) => x.requesterId !== r.requesterId));
    } catch (e) {
      console.error("[IncomingCircleInbox] decline failed", e);
      setError("Couldn't decline — try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (!signedIn) return null;

  const count = requests.length;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Circle requests${count > 0 ? ` (${count} pending)` : ""}`}
        className="relative p-2 rounded-full bg-[#1E1E24] border border-white/10 text-slate-300 hover:text-white transition-colors"
      >
        <UserPlus className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-white/10 bg-[#1E1E24] shadow-2xl z-40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Circle requests</span>
            <span className="ml-auto text-[11px] text-slate-500">{count} pending</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : error ? (
              <div className="p-4 text-xs text-red-300">{error}</div>
            ) : requests.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-sm text-slate-300 font-medium">No pending requests</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  When someone asks to join your circle, they'll show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {requests.map((r) => {
                  const busy = busyId === r.requesterId;
                  const label = r.requesterName || r.requesterSlug || "Unknown user";
                  const initials =
                    label
                      .split(/[\s-]+/)
                      .map((w) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "??";
                  return (
                    <li key={r.requesterId} className="flex items-center gap-3 px-3 py-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        {r.requesterSlug ? (
                          <Link
                            to="/profile/$id"
                            params={{ id: r.requesterSlug }}
                            onClick={() => setOpen(false)}
                            className="text-sm font-semibold text-white hover:text-emerald-300 truncate block"
                          >
                            {label}
                          </Link>
                        ) : (
                          <div className="text-sm font-semibold text-white truncate">{label}</div>
                        )}
                        <div className="text-[10px] text-slate-500">
                          {relativeTime(r.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleAccept(r)}
                          disabled={busy}
                          aria-label={`Accept request from ${label}`}
                          className="p-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDecline(r)}
                          disabled={busy}
                          aria-label={`Decline request from ${label}`}
                          className="p-1.5 rounded-[10px] border border-white/10 text-slate-300 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
