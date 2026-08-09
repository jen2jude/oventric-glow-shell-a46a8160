import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoryUploadUrl,
  listStories,
  publishStories,
  type StoryGroup,
} from "@/lib/stories.functions";

export const MAX_STORY_FILES = 10;

/**
 * Live 24h stories: rail data + upload pipeline with ring progress (0 → 1).
 */
export function useStoryRail(enabled: boolean) {
  const loadStories = useServerFn(listStories);
  const getUploadUrl = useServerFn(getStoryUploadUrl);
  const publish = useServerFn(publishStories);

  const [progress, setProgress] = useState<number | null>(null);
  const busy = useRef(false);

  const q = useQuery<{ groups: StoryGroup[] }>({
    queryKey: ["stories-rail"],
    queryFn: () => loadStories(),
    enabled,
    staleTime: 60 * 1000,
  });

  const upload = useCallback(
    async (files: File[]) => {
      if (busy.current || files.length === 0) return;
      busy.current = true;
      const list = files.slice(0, MAX_STORY_FILES);
      setProgress(0.02);
      try {
        const uploaded: { path: string; mediaType: "image" | "video" }[] = [];
        for (let i = 0; i < list.length; i++) {
          const file = list[i];
          const slot = await getUploadUrl({ data: { filename: file.name } });
          const { error } = await supabase.storage
            .from("story-media")
            .uploadToSignedUrl(slot.path, slot.token, file);
          if (!error) {
            uploaded.push({
              path: slot.path,
              mediaType: file.type.startsWith("video") ? "video" : "image",
            });
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
    [getUploadUrl, publish, q],
  );

  return {
    groups: q.data?.groups ?? [],
    loading: q.isLoading,
    refresh: q.refetch,
    uploading: progress !== null,
    progress: progress ?? 0,
    upload,
  };
}
