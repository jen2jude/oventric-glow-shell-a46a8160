import { useEffect, useState } from "react";
import { X, Lock, Users2, Loader2, Check, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listCirclesForUser,
  requestJoinCircle,
  cancelJoinRequest,
  type CircleSummary,
} from "@/lib/circles-groups.functions";

import { ResponsiveImage } from "@/components/ui/responsive-image";
interface Props {
  open: boolean;
  onClose: () => void;
  /** The profile owner whose circles we are showing. */
  userId: string;
  userName: string;
}

export function JoinCirclePickerModal({ open, onClose, userId, userName }: Props) {
  const [circles, setCircles] = useState<CircleSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useServerFn(listCirclesForUser);
  const join = useServerFn(requestJoinCircle);
  const cancel = useServerFn(cancelJoinRequest);

  useEffect(() => {
    if (!open) return;
    setCircles(null);
    setErr(null);
    load({ data: { userId } })
      .then((r) => setCircles(r))
      .catch((e) => setErr(e?.message ?? "Failed to load circles"));
  }, [open, userId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleJoin = async (c: CircleSummary) => {
    setBusyId(c.id);
    setErr(null);
    try {
      const r = await join({ data: { circleId: c.id } });
      setCircles(
        (prev) => prev?.map((x) => (x.id === c.id ? { ...x, myStatus: r.status } : x)) ?? prev,
      );
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (c: CircleSummary) => {
    setBusyId(c.id);
    setErr(null);
    try {
      await cancel({ data: { circleId: c.id } });
      setCircles(
        (prev) => prev?.map((x) => (x.id === c.id ? { ...x, myStatus: "none" } : x)) ?? prev,
      );
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-light fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-[#16161B] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white text-lg font-black">Join a Circle</h2>
            <p className="text-xs text-slate-400 mt-0.5">Circles {userName} belongs to</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[10px] text-slate-400 hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {circles === null && !err && (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading circles…
            </div>
          )}
          {err && <div className="text-red-400 text-sm px-1">{err}</div>}
          {circles && circles.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Users2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{userName} hasn't joined any circles yet.</p>
            </div>
          )}
          {circles?.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-[10px] bg-[#1E1E24] border border-white/10 hover:border-emerald-500/40 transition-colors"
            >
              <div className="w-11 h-11 rounded-[10px] bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-black font-black overflow-hidden shrink-0">
                {c.avatarUrl ? (
                  <ResponsiveImage
                    sizes="48px"
                    src={c.avatarUrl}
                    alt={c.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  c.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="text-white font-bold text-sm truncate">{c.name}</div>
                  {c.isPrivate && (
                    <Lock className="w-3 h-3 text-slate-500 shrink-0" aria-label="Private circle" />
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                  {c.myRole && <span className="text-emerald-400"> · You are {c.myRole}</span>}
                </div>
              </div>
              {c.myStatus === "member" ? (
                <span className="text-xs font-semibold text-emerald-300 px-3 py-1.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Joined
                </span>
              ) : c.myStatus === "pending" ? (
                <button
                  onClick={() => handleCancel(c)}
                  disabled={busyId === c.id}
                  className="text-xs font-semibold text-yellow-300 px-3 py-1.5 rounded-[10px] bg-yellow-500/10 border border-yellow-500/40 hover:bg-yellow-500/20 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {busyId === c.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  Requested
                </button>
              ) : (
                <button
                  onClick={() => handleJoin(c)}
                  disabled={busyId === c.id}
                  className="text-xs font-black text-black px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {busyId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Request"}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-slate-500">
          Only the circle owner can approve your request.
        </div>
      </div>
    </div>
  );
}
