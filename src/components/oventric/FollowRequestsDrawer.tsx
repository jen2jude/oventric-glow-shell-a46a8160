import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { X, Loader2, UserPlus, Check, Ban, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listIncomingFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
  type IncomingFollowRequest,
} from "@/lib/follows.functions";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Drawer that shows pending incoming follow requests with Accept / Decline
 * actions. Subscribes to `follow_requests` in realtime so newly arriving
 * requests appear without a manual refresh.
 */
export function FollowRequestsDrawer({ open, onClose }: Props) {
  const [rows, setRows] = useState<IncomingFollowRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const listFn = useServerFn(listIncomingFollowRequests);
  const acceptFn = useServerFn(acceptFollowRequest);
  const declineFn = useServerFn(declineFollowRequest);

  const load = useCallback(() => {
    setErr(null);
    listFn()
      .then((r) => setRows(r))
      .catch((e) => {
        console.error("[FollowRequestsDrawer] load", e);
        setErr(e instanceof Error ? e.message : "Failed to load requests");
        setRows([]);
      });
  }, [listFn]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  // Realtime — refresh whenever incoming follow_requests change.
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel("incoming-follow-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_requests" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, load]);

  const act = async (
    requesterId: string,
    fn: (input: { data: { requesterId: string } }) => Promise<unknown>,
  ) => {
    setBusy(requesterId);
    try {
      await fn({ data: { requesterId } });
      setRows((rs) => (rs ?? []).filter((r) => r.requesterId !== requesterId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-light fixed inset-0 z-[200] flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-requests-title"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm h-full bg-[#141418] border-l border-white/10 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 z-10 bg-[#141418] px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Follow requests
            </div>
            <h2 id="follow-requests-title" className="text-white font-black text-lg mt-0.5">
              Approve who follows you
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

        <div className="p-5 space-y-3">
          {err && (
            <p role="alert" className="text-xs text-red-400 border-l-2 border-red-500 pl-2">
              {err}
            </p>
          )}
          {rows === null ? (
            <div className="py-8 flex items-center justify-center text-slate-500 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <UserPlus className="w-6 h-6 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400 mt-2">No pending requests.</p>
              <p className="text-xs text-slate-600 mt-1">
                When someone asks to follow you, it will appear here.
              </p>
            </div>
          ) : (
            rows.map((r) => (
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
                    <img loading="lazy" decoding="async" src={r.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-semibold truncate">{r.requesterName}</div>
                  <div className="text-[11px] text-slate-500">wants to follow you</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => act(r.requesterId, acceptFn)}
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
                    onClick={() => act(r.requesterId, declineFn)}
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
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
