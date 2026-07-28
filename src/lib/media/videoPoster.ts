// Client-only helper: capture the first frame of a user-selected video file
// as a JPEG blob, so we can upload it alongside the video and use it as a
// <video poster="..."> for instant paint in the feed and reel viewer.

export async function generateVideoPoster(
  file: File,
  opts?: { maxWidth?: number; quality?: number; seekSeconds?: number },
): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  const maxWidth = opts?.maxWidth ?? 1280;
  const quality = opts?.quality ?? 0.72;
  const seek = opts?.seekSeconds ?? 0.1;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        video.removeEventListener("loadeddata", onLoaded);
        resolve();
      };
      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("error", () => reject(new Error("video load failed")), { once: true });
      setTimeout(() => reject(new Error("video load timeout")), 8000);
    });

    // Seek slightly past 0 so we get a real frame, not a black frame.
    await new Promise<void>((resolve) => {
      const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
      video.addEventListener("seeked", onSeeked, { once: true });
      try { video.currentTime = Math.min(seek, Math.max(0, (video.duration || 1) - 0.05)); }
      catch { resolve(); }
      setTimeout(resolve, 2000);
    });

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    if (!vw || !vh) return null;
    const scale = Math.min(1, maxWidth / vw);
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
  } catch {
    return null;
  } finally {
    try { video.src = ""; } catch {}
    URL.revokeObjectURL(url);
  }
}

export function posterPathFor(videoPath: string): string {
  return `${videoPath}.poster.jpg`;
}
