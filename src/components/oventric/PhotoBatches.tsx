import { useMemo, useState } from "react";
import { X, Images as ImagesIcon, UserCircle2, Image as ImageIcon, FileImage } from "lucide-react";
import { ImageLightbox } from "@/components/oventric/feed/ImageLightbox";
import type { UserPhoto } from "@/lib/posts.functions";

type Batch = {
  id: string;
  kind: "avatar" | "cover" | "post";
  label: string;
  photos: UserPhoto[];
};

function groupPhotos(photos: UserPhoto[]): Batch[] {
  const avatars = photos.filter((p) => p.source === "avatar");
  const covers = photos.filter((p) => p.source === "cover");
  const posts = photos.filter((p) => p.source === "post");

  const batches: Batch[] = [];
  if (avatars.length)
    batches.push({ id: "avatar", kind: "avatar", label: "Profile photos", photos: avatars });
  if (covers.length)
    batches.push({ id: "cover", kind: "cover", label: "Cover photos", photos: covers });

  // Combine all post images into a single "Posts" batch regardless of source post
  if (posts.length) {
    batches.push({
      id: "posts",
      kind: "post",
      label: "Post photos",
      photos: posts,
    });
  }
  return batches;
}

function BatchIcon({ kind }: { kind: Batch["kind"] }) {
  const Cmp = kind === "avatar" ? UserCircle2 : kind === "cover" ? ImageIcon : FileImage;
  return <Cmp className="w-3 h-3" />;
}

export function PhotoBatches({ photos, dense = false }: { photos: UserPhoto[]; dense?: boolean }) {
  const batches = useMemo(() => groupPhotos(photos), [photos]);
  const [openBatch, setOpenBatch] = useState<Batch | null>(null);
  const [lb, setLb] = useState<{ images: string[]; index: number } | null>(null);

  if (batches.length === 0) return null;

  const grid = dense
    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3";

  return (
    <>
      <div className={grid}>
        {batches.map((b) => {
          const cover = b.photos[0];
          const extra = b.photos.length - 1;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setOpenBatch(b)}
              aria-label={`${b.label}, ${b.photos.length} photo${b.photos.length === 1 ? "" : "s"}`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 md:border-slate-200 bg-neutral-900 hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-colors"
            >
              <img loading="lazy" decoding="async"
                src={cover.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 border border-white/20 text-white">
                <BatchIcon kind={b.kind} />
                {b.kind === "avatar" ? "Profile" : b.kind === "cover" ? "Cover" : "Post"}
              </span>
              {extra > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white font-bold text-2xl sm:text-3xl">
                  +{extra}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {openBatch && (
        <BatchTileOverlay
          batch={openBatch}
          onClose={() => setOpenBatch(null)}
          onPick={(i) => setLb({ images: openBatch.photos.map((p) => p.url), index: i })}
        />
      )}

      {lb && <ImageLightbox images={lb.images} startIndex={lb.index} onClose={() => setLb(null)} />}
    </>
  );
}

function BatchTileOverlay({
  batch,
  onClose,
  onPick,
}: {
  batch: Batch;
  onClose: () => void;
  onPick: (index: number) => void;
}) {
  return (
    <div
      className="modal-light fixed inset-0 z-[95] bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 md:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center gap-2 text-sm text-white md:text-slate-900 font-semibold">
          <ImagesIcon className="w-4 h-4 text-emerald-300" />
          <span>{batch.label}</span>
          <span className="text-slate-400 md:text-slate-500 font-normal">
            · {batch.photos.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {batch.photos.map((p, i) => (
            <button
              key={p.url + i}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Open photo ${i + 1} of ${batch.photos.length}`}
              className="relative aspect-square overflow-hidden rounded-xl border border-white/10 md:border-slate-200 bg-neutral-900 hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-colors"
            >
              <img loading="lazy" decoding="async"
                src={p.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
