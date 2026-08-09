import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoryPosterUploadUrl,
  getStoryUploadUrl,
  listStories,
  publishStories,
  type StoryGroup,
} from "@/lib/stories.functions";
import { generateVideoPoster } from "@/lib/media/videoPoster";
import {
  MAX_STORY_VIDEO_BYTES,
  MAX_STORY_VIDEO_SECONDS,
  getVideoDuration,
  trimVideoSegment,
} from "@/lib/media/videoTrim";

export const MAX_STORY_FILES = 10;

export type TrimRequest = { file: File; duration: number };

/**
 * Live 24h stories: rail data + upload pipeline with ring progress (0 → 1).
 * Videos are capped at 30s / 3MB — longer clips open the trimmer first, and
 * every video ships with a poster frame for instant paint.
 */
export function useStoryRail(enabled: boolean) {
  const loadStories = useServerFn(listStories);
  const getUploadUrl = useServerFn(getStoryUploadUrl);
  const getPosterUrl = useServerFn(getStoryPosterUploadUrl);
  const publish = useServerFn(publishStories);

  const [progress, setProgress] = useState<number | null>(null);
  const [trimRequest, setTrimRequest] = useState<TrimRequest | null>(null);
  const [trimWorking, setTrimWorking] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const trimResolver = useRef<((f: File | null) => void) | null>(null);
  const busy = useRef(false);

  const q = useQuery<{ groups: StoryGroup[] }>({
    queryKey: ["stories-rail"],
    queryFn: () => loadStories(),
    enabled,
    staleTime: 60 * 1000,
  });

  /** Ask the user to pick a 30s window; resolves with the trimmed file. */
  const askTrim = useCallback((file: File, duration: number) => {
    setTrimProgress(0);
    setTrimWorking(false);
    setTrimRequest({ file, duration });
    return new Promise<File | null>((resolve) => {
      trimResolver.current = resolve;
    });
  }, []);

  const cancelTrim = useCallback(() => {
    setTrimRequest(null);
    setTrimWorking(false);
    trimResolver.current?.(null);
    trimResolver.current = null;
  }, []);

  const confirmTrim = useCallback(
    async (start: number) => {
      const req = trimRequest;
      if (!req) return;
      setTrimWorking(true);
      const clip = await trimVideoSegment(
        req.file,
        start,
        Math.min(MAX_STORY_VIDEO_SECONDS, Math.max(1, req.duration - start)),
        setTrimProgress,
      );
      setTrimRequest(null);
      setTrimWorking(false);
      trimResolver.current?.(clip);
      trimResolver.current = null;
    },
    [trimRequest],
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (busy.current || files.length === 0) return;
      busy.current = true;
      const list = files.slice(0, MAX_STORY_FILES);
      setProgress(0.02);
      try {
        const uploaded: { path: string; mediaType: "image" | "video" }[] = [];
        for (let i = 0; i < list.length; i++) {
          let file = list[i];
          if (!file) continue;
          const isVideo = file.type.startsWith("video");

          if (isVideo) {
            const duration = await getVideoDuration(file);
            if (duration > MAX_STORY_VIDEO_SECONDS + 0.5) {
              const clip = await askTrim(file, duration);
              if (!clip) continue;
              file = clip;
            } else if (file.size > MAX_STORY_VIDEO_BYTES) {
              // Short but heavy — re-encode the whole clip to shrink it.
              const compact = await trimVideoSegment(
                file,
                0,
                Math.max(1, Math.min(MAX_STORY_VIDEO_SECONDS, duration || MAX_STORY_VIDEO_SECONDS)),
              );
              if (compact) file = compact;
            }
            if (file.size > MAX_STORY_VIDEO_BYTES * 1.5) continue;
          }

          const poster = isVideo ? await generateVideoPoster(file) : null;

          const slot = await getUploadUrl({ data: { filename: file.name } });
          const { error } = await supabase.storage
            .from("story-media")
            .uploadToSignedUrl(slot.path, slot.token, file);
          if (!error) {
            uploaded.push({ path: slot.path, mediaType: isVideo ? "video" : "image" });
            if (poster) {
              try {
                const ps = await getPosterUrl({ data: { videoPath: slot.path } });
                await supabase.storage
                  .from("story-media")
                  .uploadToSignedUrl(ps.path, ps.token, poster);
              } catch {
                /* poster is best-effort */
              }
            }
          }
          setProgress((i + 1) / (list.length + 0.5));
        }
        if (uploaded.length) await publish({ data: { items: uploaded } });
        setProgress(1);
        await q.refetch();
      } finally {
        setTimeout(() => setProgress(null), 450);
        busy.current = false;
      }
    },
    [askTrim, getPosterUrl, getUploadUrl, publish, q],
  );

  return {
    groups: q.data?.groups ?? [],
    loading: q.isLoading,
    refresh: q.refetch,
    uploading: progress !== null,
    progress: progress ?? 0,
    upload,
    trimRequest,
    trimWorking,
    trimProgress,
    cancelTrim,
    confirmTrim,
  };
}
