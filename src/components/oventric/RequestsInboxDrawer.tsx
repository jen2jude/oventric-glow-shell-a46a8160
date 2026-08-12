import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, UserPlus, Check, Ban, User as UserIcon, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listIncomingFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
  type IncomingFollowRequest,
} from "@/lib/follows.functions";
import {
  acceptIncomingRequest,
  declineIncomingRequest,
  ensureMyProfile,
  listIncomingCircleRequests,
  type IncomingCircleRequest,
} from "@/lib/circles.functions";

type Tab = "follow" | "circle";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RequestsInboxDrawer({ open, onClose, initialTab = "follow" }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  // Follow requests
  const [followRows, setFollowRows] = useState<IncomingFollowRequest[] | null>(null);
  const listFollow = useServerFn(listIncomingFollowRequests);
  const acceptFollow = useServerFn(acceptFollowRequest);
  const declineFollow = useServerFn(declineFollowRequest);

  // Circle requests
  const [circleRows, setCircleRows] = useState<IncomingCircleRequest[] | null>(null);
  const listCircle = useServerFn(listIncomingCircleRequests);
  const acceptCircle = useServerFn(acceptIncomingRequest);
  const declineCircle = useServerFn(declineIncomingRequest);
  const ensure = useServerFn(ensureMyProfile);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const loadFollow = useCallback(() => {
    setErr(null);
    listFollow()
      .then((r) => setFollowRows(r))
      .catch((e) => {
        console.error("[RequestsInboxDrawer] follow load", e);
        setErr(e instanceof Error ? e.message : "Failed to load follow requests");
        setFollowRows([]);
      });
  }, [listFollow]);

  const loadCircle = useCallback(async () => {
    setErr(null);
    try {
      await ensure();
    } catch (e) {
      console.error("[RequestsInboxDrawer] ensure profile", e);
    }
    try {
      const r = await listCircle();
      setCircleRows(r);
    } catch (e) {
      console.error("[RequestsInboxDrawer] circle load", e);
      setErr(e instanceof Error ? e.message : "Failed to load circle requests");
      setCircleRows([]);
    }
  }, [listCircle, ensure]);

  useEffect(() => {
    if (!open) return;
    loadFollow();
    loadCircle();
  }, [open, loadFollow, loadCircle]);

  // Realtime refresh for both tables while open
  useEffect(() => {
    if (!open) return;
    const ch = supabase
      .channel("requests-inbox-drawer")
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_requests" }, () =>
        loadFollow(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_requests" }, () =>
        loadCircle(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, loadFollow, loadCircle]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const actFollow = async (
    requesterId: string,
    fn: (input: { data: { requesterId: string } }) => Promise<unknown>,
  ) => {
    setBusy(requesterId);
    try {
      await fn({ data: { requesterId } });
      setFollowRows((rs) => (rs ?? []).filter((r) => r.requesterId !== requesterId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const actCircle = async (
    requesterId: string,
    fn: (input: { data: { requesterId: string } }) => Promise<unknown>,
  ) => {
    setBusy(requesterId);
    try {
      await fn({ data: { requesterId } });
      setCircleRows((rs) => (rs ?? []).filter((r) => r.requesterId !== requesterId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const followCount = followRows?.length ?? 0;
  const circleCount = circleRows?.length ?? 0;

  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[200] flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="requests-inbox-title"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm h-full bg-[#141418] border-l border-white/10 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 z-10 bg-[#141418] px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Requests
            </div>
            <h2 id="requests-inbox-title" className="text-white font-black text-lg mt-0.5">
              Approve who connects with you
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-[10px] text-slate-500 hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab toggle */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-[#1E1E24] border border-white/10">
            <button
              type="button"
              onClick={() => setTab("follow")}
              aria-pressed={tab === "follow"}
              className={`inline-flex items-center justify-center gap-1.5 py-3 rounded-[10px] text-xs font-bold transition-colors ${
                tab === "follow" ? "bg-emerald-500 text-black" : "text-slate-300 hover:text-white"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Follow
              {followCount > 0 && (
                <span
                  className={`ml-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black inline-flex items-center justify-center ${
                    tab === "follow" ? "bg-black/20 text-black" : "bg-emerald-500 text-black"
                  }`}
                >
                  {followCount > 9 ? "9+" : followCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("circle")}
              aria-pressed={tab === "circle"}
              className={`inline-flex items-center justify-center gap-1.5 py-3 rounded-[10px] text-xs font-bold transition-colors ${
                tab === "circle" ? "bg-emerald-500 text-black" : "text-slate-300 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Circle
              {circleCount > 0 && (
                <span
                  className={`ml-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black inline-flex items-center justify-center ${
                    tab === "circle" ? "bg-black/20 text-black" : "bg-emerald-500 text-black"
                  }`}
                >
                  {circleCount > 9 ? "9+" : circleCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {err && (
            <p role="alert" className="text-xs text-red-400 border-l-2 border-red-500 pl-2">
              {err}
            </p>
          )}

          {tab === "follow" ? (
            followRows === null ? (
              <LoadingRow />
            ) : followRows.length === 0 ? (
              <EmptyBlock
                icon={<UserPlus className="w-6 h-6 text-slate-600 mx-auto" />}
                title="No pending follow requests."
                body="When someone asks to follow you, it will appear here."
              />
            ) : (
              followRows.map((r) => (
                <div
                  key={r.requesterId}
                  className="flex items-center gap-3 p-3 rounded-[10px] bg-[#1E1E24] border border-white/10"
                >
                  <button
                    onClick={() => {
                      if (r.requesterSlug) {
                        navigate({ to: "/profile/$id", params: { id: r.requesterSlug } });
                        onClose();
                      }
                    }}
                    className="shrink-0"
                    aria-label={`Open ${r.requesterName}'s profile`}
                  >
                    {r.avatarUrl ? (
                      <img loading="lazy" decoding="async"
                        src={r.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-semibold truncate">
                      {r.requesterName}
                    </div>
                    <div className="text-[11px] text-slate-500">wants to follow you</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => actFollow(r.requesterId, acceptFollow)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 disabled:opacity-60"
                      aria-label={`Accept ${r.requesterName}`}
                    >
                      {busy === r.requesterId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => actFollow(r.requesterId, declineFollow)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/5 disabled:opacity-60"
                      aria-label={`Decline ${r.requesterName}`}
                    >
                      <Ban className="w-3 h-3" />
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )
          ) : circleRows === null ? (
            <LoadingRow />
          ) : circleRows.length === 0 ? (
            <EmptyBlock
              icon={<Users className="w-6 h-6 text-slate-600 mx-auto" />}
              title="No pending circle requests."
              body="When someone asks to join your circle, it will appear here."
            />
          ) : (
            circleRows.map((r) => {
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
                <div
                  key={r.requesterId}
                  className="flex items-center gap-3 p-3 rounded-[10px] bg-[#1E1E24] border border-white/10"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-xs shrink-0">
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
                      wants to join your circle · {relTime(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => actCircle(r.requesterId, acceptCircle)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 disabled:opacity-60"
                      aria-label={`Accept ${label}`}
                    >
                      {busy === r.requesterId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => actCircle(r.requesterId, declineCircle)}
                      disabled={busy === r.requesterId}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/5 disabled:opacity-60"
                      aria-label={`Decline ${label}`}
                    >
                      <Ban className="w-3 h-3" />
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LoadingRow() {
  return (
    <div className="py-8 flex items-center justify-center text-slate-500 text-sm gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>
  );
}

function EmptyBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      {icon}
      <p className="text-sm text-slate-400 mt-2">{title}</p>
      <p className="text-xs text-slate-600 mt-1">{body}</p>
    </div>
  );
}
