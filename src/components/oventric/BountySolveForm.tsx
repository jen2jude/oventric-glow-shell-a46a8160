import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Paperclip,
  Loader2,
  Send,
  Save,
  X,
  FileText,
  Clock,
  CheckCircle2,
  Download,
  Eye,
  GripVertical,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  getBountySubmission,
  saveBountySubmission,
  uploadSubmissionFile,
  type SubmissionFile,
  type SubmissionView,
} from "@/lib/bounty-submission.functions";

interface Props {
  bountyId: string;
  /** true when the viewer is the assigned solver */
  canSubmit: boolean;
  /** already marked delivered */
  delivered: boolean;
  /** called after a successful submit so the parent can mark the bounty delivered */
  onDelivered?: () => Promise<void> | void;
}

const TIMELINES = ["Within 24 hours", "2-3 days", "Within a week", "2 weeks", "Custom"];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPE_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/zip",
  "application/msword",
  "application/vnd.",
];

function isAllowedType(type: string) {
  if (!type) return true;
  return ALLOWED_TYPE_PREFIXES.some((p) => type.startsWith(p));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

function prettySize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BountySolveForm({ bountyId, canSubmit, delivered, onDelivered }: Props) {
  const getFn = useServerFn(getBountySubmission);
  const saveFn = useServerFn(saveBountySubmission);
  const uploadFn = useServerFn(uploadSubmissionFile);

  const [view, setView] = useState<SubmissionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [timeline, setTimeline] = useState("");
  const [customTimeline, setCustomTimeline] = useState("");
  const [files, setFiles] = useState<Array<SubmissionFile & { url?: string | null }>>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, "uploading" | "error">>({});
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = (await getFn({ data: { bounty_id: bountyId } })) as SubmissionView | null;
      setView(v);
      if (v) {
        setSummary(v.summary);
        setFiles(v.files);
        if (v.timeline && !TIMELINES.includes(v.timeline)) {
          setTimeline("Custom");
          setCustomTimeline(v.timeline);
        } else {
          setTimeline(v.timeline);
        }
      }
    } catch {
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [bountyId, getFn]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(
    () => () => {
      Object.values(previewsRef.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const doRemoveFile = (path: string) => {
    const removed = files.find((x) => x.path === path);
    const removedIndex = files.findIndex((x) => x.path === path);
    setFiles((prev) => prev.filter((x) => x.path !== path));
    setPreviews((prev) => {
      const u = prev[path];
      if (u) URL.revokeObjectURL(u);
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (removed) {
      toast(`Removed ${removed.name}`, {
        action: {
          label: "Undo",
          onClick: () => {
            setFiles((prev) => {
              const next = [...prev];
              next.splice(Math.min(removedIndex, next.length), 0, removed);
              return next;
            });
          },
        },
        duration: 6000,
      });
    }
  };

  const requestRemoveFile = (path: string) => {
    setRemoveConfirm(path);
  };

  const resolvedTimeline = timeline === "Custom" ? customTimeline.trim() : timeline;

  const pickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setErr(null);
    setFileErrors([]);
    const incoming = Array.from(list).slice(0, 10 - files.length);
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) {
        errors.push(`${f.name}: file is larger than 10MB`);
        continue;
      }
      if (!isAllowedType(f.type)) {
        errors.push(`${f.name}: unsupported file type${f.type ? ` (${f.type})` : ""}`);
        continue;
      }
      valid.push(f);
    }
    if (errors.length) setFileErrors(errors);

    await Promise.all(
      valid.map(async (f) => {
        const key = `${f.name}-${f.size}-${Date.now()}`;
        setUploadProgress((prev) => ({ ...prev, [key]: "uploading" }));
        try {
          const b64 = await fileToBase64(f);
          const saved = (await uploadFn({
            data: { bounty_id: bountyId, name: f.name, type: f.type, data_base64: b64 },
          })) as SubmissionFile;
          if (f.type.startsWith("image/")) {
            const objUrl = URL.createObjectURL(f);
            setPreviews((prev) => ({ ...prev, [saved.path]: objUrl }));
          }
          setFiles((prev) => [...prev, saved]);
        } catch (e) {
          setFileErrors((prev) => [...prev, `${f.name}: ${(e as Error).message}`]);
        } finally {
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }),
    );
    if (inputRef.current) inputRef.current.value = "";
  };

  const persist = async (submit: boolean) => {
    setErr(null);
    setMsg(null);
    setBusy(submit ? "submit" : "save");
    try {
      await saveFn({
        data: {
          bounty_id: bountyId,
          summary,
          timeline: resolvedTimeline,
          files: files.map(({ path, name, size, type }) => ({ path, name, size, type })),
          submit,
        },
      });
      if (submit) {
        await onDelivered?.();
        setMsg("Solution submitted — the poster has been notified.");
      } else {
        setMsg("Draft saved.");
      }
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
      setConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl p-5 mb-5">
        <div className="h-4 w-40 bg-white/10 md:bg-slate-200 rounded animate-pulse mb-3" />
        <div className="h-24 w-full bg-white/5 md:bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!view) return null;

  const readOnly = !canSubmit || !view.can_edit;

  // Poster / admin read-only view
  if (readOnly) {
    if (!view.submitted_at && !view.summary) return null;
    return (
      <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl p-5 mb-5">
        <div className="text-white md:text-slate-900 font-bold text-sm mb-1 inline-flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400" /> Submitted solution
        </div>
        {view.submitted_at && (
          <div className="text-[11px] text-slate-400 md:text-slate-500 mb-3">
            Delivered {new Date(view.submitted_at).toLocaleString()}
          </div>
        )}
        <p className="text-sm text-slate-200 md:text-slate-700 whitespace-pre-wrap mb-3">
          {view.summary}
        </p>
        {view.timeline && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 md:text-sky-700 bg-sky-500/10 md:bg-sky-50 border border-sky-500/30 md:border-sky-200 rounded-[10px] px-2.5 py-1 mb-3">
            <Clock className="w-3.5 h-3.5" /> {view.timeline}
          </div>
        )}
        {view.files.length > 0 && (
          <div className="space-y-2">
            {view.files.map((f) => (
              <a
                key={f.path}
                href={f.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-sm text-white md:text-slate-800 hover:bg-white/10 md:hover:bg-slate-100"
              >
                <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-[11px] text-slate-400">{prettySize(f.size)}</span>
                <Download className="w-4 h-4 text-slate-400" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isUploading = Object.keys(uploadProgress).length > 0;

  // Solver form
  return (
    <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl p-5 mb-5">
      <div className="text-white md:text-slate-900 font-bold text-sm mb-1 inline-flex items-center gap-2">
        <Send className="w-4 h-4 text-sky-400" /> Submit your solution
      </div>
      <p className="text-xs text-slate-400 md:text-slate-500 mb-4">
        Describe what you delivered, set an estimated timeline and attach any supporting files. The
        poster reviews this before releasing the funds.
      </p>

      <label className="block text-xs font-semibold text-slate-300 md:text-slate-600 mb-1.5">
        Solution description
      </label>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={5}
        maxLength={8000}
        placeholder="Explain your approach, what's included, and how the poster should review it…"
        className="w-full rounded-[10px] bg-[#141418] md:bg-slate-50 border border-white/10 md:border-slate-200 text-sm text-white md:text-slate-900 placeholder:text-slate-500 p-3 outline-none focus:border-sky-500/60 resize-y"
      />
      <div className="text-[11px] text-slate-500 mt-1 mb-4">{summary.length}/8000</div>

      <label className="block text-xs font-semibold text-slate-300 md:text-slate-600 mb-1.5">
        Estimated timeline
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {TIMELINES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTimeline(t)}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-colors ${
              timeline === t
                ? "bg-sky-500 border-sky-500 text-black"
                : "bg-white/5 md:bg-slate-50 border-white/10 md:border-slate-200 text-slate-300 md:text-slate-600 hover:bg-white/10 md:hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {timeline === "Custom" && (
        <input
          value={customTimeline}
          onChange={(e) => setCustomTimeline(e.target.value)}
          maxLength={200}
          placeholder="e.g. Final files by Friday 6pm"
          className="w-full rounded-[10px] bg-[#141418] md:bg-slate-50 border border-white/10 md:border-slate-200 text-sm text-white md:text-slate-900 placeholder:text-slate-500 px-3 py-2 outline-none focus:border-sky-500/60 mb-2"
        />
      )}

      <label className="block text-xs font-semibold text-slate-300 md:text-slate-600 mt-4 mb-1.5">
        Attachments <span className="font-normal text-slate-500">(up to 10 files, 10MB each)</span>
      </label>
      <div className="space-y-2 mb-2">
        {files.map((f, idx) => {
          const preview =
            previews[f.path] ?? (f.type?.startsWith("image/") ? (f.url ?? null) : null);
          const openUrl = preview ?? f.url ?? null;
          return (
            <div
              key={f.path}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex === null || dragIndex === idx) return;
                setFiles((prev) => {
                  const next = [...prev];
                  const [moved] = next.splice(dragIndex, 1);
                  next.splice(idx, 0, moved);
                  return next;
                });
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-3 p-2 rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-sm text-white md:text-slate-800 ${dragIndex === idx ? "opacity-50" : ""}`}
            >
              <span className="text-slate-500 cursor-grab shrink-0" aria-hidden="true">
                <GripVertical className="w-4 h-4" />
              </span>
              {preview ? (
                <img
                  src={preview}
                  alt={f.name}
                  className="w-11 h-11 rounded-[10px] object-cover border border-white/10 md:border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-[10px] bg-white/5 md:bg-white border border-white/10 md:border-slate-200 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-[11px] text-slate-400">
                  {prettySize(f.size)}
                  {f.type ? ` · ${f.type.split("/").pop()}` : ""}
                </div>
              </div>
              {openUrl && (
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-sky-400 shrink-0"
                  aria-label={`Preview ${f.name}`}
                >
                  <Eye className="w-4 h-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => requestRemoveFile(f.path)}
                className="text-slate-400 hover:text-red-400 shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {isUploading &&
          Object.keys(uploadProgress).map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 p-2 rounded-[10px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-sm text-slate-400"
            >
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="truncate flex-1">Uploading…</span>
            </div>
          ))}
      </div>
      {fileErrors.length > 0 && (
        <div className="mb-2 space-y-1">
          {fileErrors.map((m, i) => (
            <div
              key={i}
              className="text-xs font-semibold text-red-300 md:text-red-600 bg-red-500/10 border border-red-500/30 rounded-[10px] px-3 py-2"
            >
              {m}
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void pickFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={isUploading || files.length >= 10}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold disabled:opacity-50"
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Paperclip className="w-4 h-4" />
        )}
        {isUploading ? "Uploading…" : "Attach files"}
      </button>

      {err && (
        <div className="mt-3 text-xs font-semibold text-red-300 md:text-red-600 bg-red-500/10 border border-red-500/30 rounded-[10px] px-3 py-2">
          {err}
        </div>
      )}
      {msg && (
        <div className="mt-3 text-xs font-semibold text-emerald-300 md:text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-[10px] px-3 py-2">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={() => void persist(false)}
          disabled={busy !== null || isUploading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "save" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save draft
        </button>
        {!delivered && (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={busy !== null || isUploading || summary.trim().length < 20}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-sky-500 hover:bg-sky-400 text-black text-sm font-bold disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> Submit &amp; mark delivered
          </button>
        )}
        {delivered && (
          <button
            type="button"
            onClick={() => void persist(true)}
            disabled={busy !== null || isUploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-sky-500/15 border border-sky-500/40 text-sky-200 md:text-sky-700 md:bg-sky-50 text-sm font-bold disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> Update submission
          </button>
        )}
      </div>

      {confirm && (
        <div
          className="modal-light fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white md:text-slate-900 font-bold text-base mb-1">
              Submit this solution?
            </div>
            <p className="text-sm text-slate-400 md:text-slate-600 mb-4">
              The poster is notified to review and release funds. Funds auto-release in 48 hours if
              they don't respond.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(false)}
                className="px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => void persist(true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-sky-500 hover:bg-sky-400 text-black text-sm font-bold disabled:opacity-50"
              >
                {busy === "submit" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {removeConfirm && (
        <div
          className="fixed inset-0 z-[130] bg-black/70 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => setRemoveConfirm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-attachment-title"
            className="w-full max-w-sm rounded-2xl bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="remove-attachment-title"
              className="text-white md:text-slate-900 font-bold text-base mb-1"
            >
              Remove this attachment?
            </div>
            <p className="text-sm text-slate-400 md:text-slate-600 mb-4">
              {files.find((f) => f.path === removeConfirm)?.name ?? "This file"} will be taken off
              your draft. You can undo for a few seconds afterwards.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRemoveConfirm(null)}
                className="px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold"
              >
                Keep it
              </button>
              <button
                onClick={() => {
                  const path = removeConfirm;
                  setRemoveConfirm(null);
                  doRemoveFile(path);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-red-500 hover:bg-red-400 text-black text-sm font-bold"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
