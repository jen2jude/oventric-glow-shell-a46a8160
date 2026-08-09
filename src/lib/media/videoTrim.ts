// Client-only helpers for story video limits: read duration, and re-encode a
// selected segment (max 30s) at a modest bitrate so uploads stay under ~3MB.

export const MAX_STORY_VIDEO_SECONDS = 30;
export const MAX_STORY_VIDEO_BYTES = 3 * 1024 * 1024;

export async function getVideoDuration(file: File): Promise<number> {
  if (typeof window === "undefined") return 0;
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "metadata";
  v.muted = true;
  v.src = url;
  try {
    const d = await new Promise<number>((resolve, reject) => {
      v.addEventListener("loadedmetadata", () => resolve(v.duration || 0), { once: true });
      v.addEventListener("error", () => reject(new Error("metadata failed")), { once: true });
      setTimeout(() => reject(new Error("metadata timeout")), 8000);
    });
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  } finally {
    try {
      v.src = "";
    } catch {
      /* noop */
    }
    URL.revokeObjectURL(url);
  }
}

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/**
 * Re-encode `duration` seconds of `file` starting at `start` into a compact
 * clip. Runs in real time (canvas + MediaRecorder), reporting 0→1 progress.
 */
export async function trimVideoSegment(
  file: File,
  start: number,
  duration: number,
  onProgress?: (p: number) => void,
): Promise<File | null> {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("load failed")), { once: true });
      setTimeout(() => reject(new Error("load timeout")), 12000);
    });

    await new Promise<void>((resolve) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      try {
        video.currentTime = Math.max(0, start);
      } catch {
        resolve();
      }
      setTimeout(resolve, 3000);
    });

    // Downscale to at most 720p on the long edge — keeps bitrate/size low.
    const vw = video.videoWidth || 720;
    const vh = video.videoHeight || 1280;
    const scale = Math.min(1, 720 / Math.max(vw, vh));
    const w = Math.max(2, Math.round((vw * scale) / 2) * 2);
    const h = Math.max(2, Math.round((vh * scale) / 2) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const stream = canvas.captureStream(30);
    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 700_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const endAt = Math.max(0, start) + duration;
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(250);
    await video.play().catch(() => {});

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h);
      const p = Math.min(1, (video.currentTime - start) / duration);
      onProgress?.(Math.max(0, p));
      if (video.currentTime >= endAt || video.ended) {
        video.pause();
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    await done;
    cancelAnimationFrame(raf);
    onProgress?.(1);

    const type = mimeType || "video/webm";
    const blob = new Blob(chunks, { type });
    if (!blob.size) return null;
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const base = file.name.replace(/\.[^.]+$/, "") || "story";
    return new File([blob], `${base}-clip.${ext}`, { type });
  } catch {
    return null;
  } finally {
    try {
      video.src = "";
    } catch {
      /* noop */
    }
    URL.revokeObjectURL(url);
  }
}
