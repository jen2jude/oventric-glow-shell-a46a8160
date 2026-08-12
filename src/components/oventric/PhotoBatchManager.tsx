import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Images as ImagesIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";

type Status = "queued" | "uploading" | "ready" | "failed";

type BatchRow = {
  id: string;
  title: string;
  note: string | null;
  status: Status;
  expected_count: number;
  created_at: string;
};

type ItemRow = {
  id: string;
  batch_id: string;
  path: string;
  file_name: string | null;
  size_bytes: number | null;
  status: Status;
  error: string | null;
  created_at: string;
};

const MAX_FILES = 30;
const MAX_BYTES = 10 * 1024 * 1024;

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof Clock }> = {
    queued: {
      label: "Queued",
      cls: "bg-amber-500/15 text-amber-300 md:text-amber-700 border-amber-500/30",
      Icon: Clock,
    },
    uploading: {
      label: "Uploading",
      cls: "bg-sky-500/15 text-sky-300 md:text-sky-700 border-sky-500/30",
      Icon: Loader2,
    },
    ready: {
      label: "Ready",
      cls: "bg-emerald-500/15 text-emerald-300 md:text-emerald-700 border-emerald-500/30",
      Icon: CheckCircle2,
    },
    failed: {
      label: "Failed",
      cls: "bg-rose-500/15 text-rose-300 md:text-rose-700 border-rose-500/30",
      Icon: AlertTriangle,
    },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      <Icon className={`w-3 h-3 ${status === "uploading" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10 md:bg-slate-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function PhotoBatchManager() {
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [counts, setCounts] = useState<
    Record<string, { total: number; ready: number; failed: number }>
  >({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("photo_batches")
      .select("id, title, note, status, expected_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setBatches([]);
      return;
    }
    const list = (rows ?? []) as BatchRow[];
    setBatches(list);
    if (list.length) {
      const { data: items } = await supabase
        .from("photo_batch_items")
        .select("batch_id, status")
        .in(
          "batch_id",
          list.map((b) => b.id),
        );
      const next: Record<string, { total: number; ready: number; failed: number }> = {};
      for (const b of list) next[b.id] = { total: 0, ready: 0, failed: 0 };
      for (const it of (items ?? []) as Array<{ batch_id: string; status: Status }>) {
        const c = next[it.batch_id];
        if (!c) continue;
        c.total += 1;
        if (it.status === "ready") c.ready += 1;
        if (it.status === "failed") c.failed += 1;
      }
      setCounts(next);
    } else {
      setCounts({});
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files)
      .slice(0, MAX_FILES)
      .filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) {
      toast.error("Pick image files only");
      return;
    }
    const oversized = picked.find((f) => f.size > MAX_BYTES);
    if (oversized) {
      toast.error(`${oversized.name} is larger than 10MB`);
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: picked.length });
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in first");

      const title = `Batch · ${new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`;
      const { data: batch, error: bErr } = await supabase
        .from("photo_batches")
        .insert({ user_id: uid, title, status: "uploading", expected_count: picked.length })
        .select("id, title, note, status, expected_count, created_at")
        .single();
      if (bErr || !batch) throw new Error(bErr?.message || "Could not create batch");

      const batchId = (batch as BatchRow).id;
      let failed = 0;

      for (let i = 0; i < picked.length; i++) {
        const file = picked[i]!;
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${uid}/${batchId}/${Date.now()}-${i}.${ext}`;

        const { data: itemRow } = await supabase
          .from("photo_batch_items")
          .insert({
            batch_id: batchId,
            user_id: uid,
            path,
            file_name: file.name.slice(0, 180),
            size_bytes: file.size,
            status: "uploading",
          })
          .select("id")
          .single();

        const { error: upErr } = await supabase.storage
          .from("user-photos")
          .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

        if (itemRow?.id) {
          await supabase
            .from("photo_batch_items")
            .update({
              status: upErr ? "failed" : "ready",
              error: upErr ? upErr.message.slice(0, 300) : null,
            })
            .eq("id", itemRow.id);
        }
        if (upErr) failed += 1;
        setProgress({ done: i + 1, total: picked.length });
      }

      await supabase
        .from("photo_batches")
        .update({ status: failed === picked.length ? "failed" : "ready" })
        .eq("id", batchId);

      toast.success(
        failed === 0
          ? `Uploaded ${picked.length} photo${picked.length === 1 ? "" : "s"}`
          : `Uploaded with ${failed} failure${failed === 1 ? "" : "s"}`,
      );
      await load();
      setOpenId(batchId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeBatch = async (id: string) => {
    const { data: items } = await supabase
      .from("photo_batch_items")
      .select("path")
      .eq("batch_id", id);
    const paths = ((items ?? []) as Array<{ path: string }>).map((i) => i.path);
    if (paths.length) await supabase.storage.from("user-photos").remove(paths);
    const { error } = await supabase.from("photo_batches").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete album");
      return;
    }
    toast.success("Album deleted");
    setOpenId((cur) => (cur === id ? null : cur));
    void load();
  };

  const openBatch = useMemo(() => batches?.find((b) => b.id === openId) ?? null, [batches, openId]);

  if (openBatch) {
    return (
      <BatchDetail
        batch={openBatch}
        onBack={() => setOpenId(null)}
        onDelete={() => removeBatch(openBatch.id)}
        onChanged={load}
      />
    );
  }

  return (
    <section className="space-y-3" aria-label="Photo batches">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-white md:text-slate-900">
          <ImagesIcon className="w-4 h-4 text-emerald-400" />
          Photo batches
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="p-2 rounded-xl border border-white/10 md:border-slate-200 text-slate-300 md:text-slate-600 hover:bg-white/5 md:hover:bg-slate-50 disabled:opacity-50"
            aria-label="Refresh batches"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {busy ? "Uploading…" : "Upload photos"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onPickFiles(e.target.files)}
      />

      {progress && (
        <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 md:text-slate-600">
            <span>
              Uploading {progress.done} of {progress.total}
            </span>
            <span>{Math.round((progress.done / progress.total) * 100)}%</span>
          </div>
          <ProgressBar value={(progress.done / progress.total) * 100} />
        </div>
      )}

      {batches === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 md:bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 md:border-slate-300 p-6 text-center">
          <ImagesIcon className="w-6 h-6 mx-auto text-slate-500 mb-2" />
          <p className="text-sm text-slate-300 md:text-slate-700 font-semibold">No batches yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Upload a set of photos and track its progress here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {batches.map((b) => {
            const c = counts[b.id] ?? { total: 0, ready: 0, failed: 0 };
            const total = Math.max(c.total, b.expected_count, 1);
            const pct = (c.ready / total) * 100;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setOpenId(b.id)}
                className="text-left rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-3 space-y-2 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white md:text-slate-900 truncate">
                    {b.title}
                  </span>
                  <StatusPill status={b.status} />
                </div>
                <ProgressBar value={pct} />
                <div className="flex items-center justify-between text-[11px] text-slate-400 md:text-slate-500">
                  <span>
                    {c.ready}/{Math.max(c.total, b.expected_count)} uploaded
                    {c.failed ? ` · ${c.failed} failed` : ""}
                  </span>
                  <span>{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BatchDetail({
  batch,
  onBack,
  onDelete,
  onChanged,
}: {
  batch: BatchRow;
  onBack: () => void;
  onDelete: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lb, setLb] = useState<{ images: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("photo_batch_items")
      .select("id, batch_id, path, file_name, size_bytes, status, error, created_at")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as ItemRow[];
    setItems(rows);
    const ready = rows.filter((r) => r.status === "ready").map((r) => r.path);
    if (ready.length) {
      const { data: signed } = await supabase.storage
        .from("user-photos")
        .createSignedUrls(ready, 60 * 60 * 6);
      const map: Record<string, string> = {};
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      }
      setUrls(map);
    } else {
      setUrls({});
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const readyUrls = useMemo(
    () =>
      (items ?? []).filter((i) => i.status === "ready" && urls[i.path]).map((i) => urls[i.path]!),
    [items, urls],
  );

  const removeItem = async (item: ItemRow) => {
    await supabase.storage.from("user-photos").remove([item.path]);
    const { error } = await supabase.from("photo_batch_items").delete().eq("id", item.id);
    if (error) {
      toast.error("Could not remove photo");
      return;
    }
    toast.success("Photo removed");
    await load();
    await onChanged();
  };

  const ready = (items ?? []).filter((i) => i.status === "ready").length;
  const total = items?.length ?? 0;

  return (
    <section className="space-y-3" aria-label={`Batch ${batch.title}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          All batches
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 md:text-rose-600 text-xs font-bold hover:bg-rose-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete batch
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white md:text-slate-900 truncate">
            {batch.title}
          </h3>
          <StatusPill status={batch.status} />
        </div>
        <ProgressBar value={total ? (ready / total) * 100 : 0} />
        <p className="text-[11px] text-slate-400 md:text-slate-500">
          {ready} of {total} uploaded · created {new Date(batch.created_at).toLocaleString()}
        </p>
      </div>

      {items === null ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-white/5 md:bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">This batch has no photos.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {items.map((item) => {
            const url = urls[item.path];
            const idx = url ? readyUrls.indexOf(url) : -1;
            return (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 md:border-slate-200 bg-neutral-900 md:bg-slate-100"
              >
                {url ? (
                  <button
                    type="button"
                    onClick={() => setLb({ images: readyUrls, index: Math.max(0, idx) })}
                    className="absolute inset-0"
                    aria-label={`Open ${item.file_name ?? "photo"}`}
                  >
                    <img loading="lazy" decoding="async"
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] text-slate-400">
                    {item.status === "uploading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : item.status === "failed" ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    <span className="capitalize">{item.status}</span>
                  </div>
                )}
                <span className="absolute bottom-1 left-1">
                  <StatusPill status={item.status} />
                </span>
                <button
                  type="button"
                  onClick={() => void removeItem(item)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 p-1 rounded-[10px] bg-black/70 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {lb && <ImageLightbox images={lb.images} startIndex={lb.index} onClose={() => setLb(null)} />}
    </section>
  );
}
