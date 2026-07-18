-- Multi-image posts: add media_paths array. Keep legacy media_path/media_type for backwards compatibility.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_paths TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS posts_media_paths_not_empty_idx
  ON public.posts (author_id, created_at DESC)
  WHERE array_length(media_paths, 1) > 0 OR media_path IS NOT NULL;