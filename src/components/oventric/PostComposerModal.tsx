import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Image as ImageIcon, Video as VideoIcon, AtSign, Users, Globe2, UsersRound, ChevronDown, Check, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  createPost as createPostFn,
  searchMentionCandidates as searchMentionsFn,
  listMyPostableCircles as listCirclesFn,
} from "@/lib/posts.functions";

type Audience = "public" | "circle" | "followers";
type Mention = {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};
type CircleOpt = { id: string; name: string };

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_IMAGES = 10;

function initialsOf(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase() || "OV";
}

export function PostComposerModal({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}) {
  const createPost = useServerFn(createPostFn);
  const searchMentions = useServerFn(searchMentionsFn);
  const listCircles = useServerFn(listCirclesFn);

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [audience, setAudience] = useState<Audience>("public");
  const [circleId, setCircleId] = useState<string | null>(null);
  const [circles, setCircles] = useState<CircleOpt[]>([]);
  const [audienceOpen, setAudienceOpen] = useState(false);
  // Multiple images OR a single video. Can never mix kinds.
  const [attachments, setAttachments] = useState<{ file: File; previewUrl: string; kind: "image" | "video" }[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<Mention[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(shellRef, open);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 60);
    // load circles lazily
    listCircles()
      .then((r) => setCircles(r.circles))
      .catch(() => setCircles([]));
  }, [open, listCircles]);

  // Prevent body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 480) + "px";
  }, [text, open]);

  // Debounced mention search
  useEffect(() => {
    if (!mentionPickerOpen) return;
    const q = mentionQuery.trim();
    if (!q) {
      setMentionResults([]);
      return;
    }
    let cancel = false;
    setMentionLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchMentions({ data: { q } });
        if (!cancel) setMentionResults(r.users);
      } catch {
        if (!cancel) setMentionResults([]);
      } finally {
        if (!cancel) setMentionLoading(false);
      }
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [mentionQuery, mentionPickerOpen, searchMentions]);

  const clearAttachments = useCallback(() => {
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [attachments]);

  const removeAttachmentAt = (idx: number) => {
    setAttachments((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const onPickFile = () => fileInputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const hasVideoAlready = attachments.some((a) => a.kind === "video");
    const nextAttachments = [...attachments];
    let err: string | null = null;
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) { err = "Only images or videos are allowed."; continue; }
      if (file.size > MAX_MEDIA_BYTES) { err = "One or more files exceed 50 MB."; continue; }
      if (isVideo) {
        if (nextAttachments.length > 0) { err = "Post a video by itself."; continue; }
        nextAttachments.push({ file, previewUrl: URL.createObjectURL(file), kind: "video" });
        break;
      }
      // image
      if (hasVideoAlready || nextAttachments.some((a) => a.kind === "video")) {
        err = "Post a video by itself.";
        continue;
      }
      if (nextAttachments.length >= MAX_IMAGES) { err = `Up to ${MAX_IMAGES} images per post.`; break; }
      nextAttachments.push({ file, previewUrl: URL.createObjectURL(file), kind: "image" });
    }
    setAttachments(nextAttachments);
    setError(err);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addMention = (m: Mention) => {
    if (!mentions.find((x) => x.userId === m.userId)) {
      setMentions((prev) => [...prev, m]);
      // Insert @name into the text as a hint
      const handle = m.username || m.name.replace(/\s+/g, "");
      setText((prev) => (prev ? `${prev.trimEnd()} @${handle} ` : `@${handle} `));
    }
    setMentionQuery("");
    setMentionPickerOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const removeMention = (id: string) =>
    setMentions((prev) => prev.filter((m) => m.userId !== id));

  const audienceLabel = useMemo(() => {
    if (audience === "public") return "Public";
    if (audience === "followers") return "Followers";
    const c = circles.find((x) => x.id === circleId);
    return c ? `Circle · ${c.name}` : "Circle";
  }, [audience, circleId, circles]);

  const canPost = text.trim().length > 0 && !posting && (audience !== "circle" || !!circleId);

  const doPost = async () => {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    try {
      let mediaPath: string | undefined;
      let mediaType: "image" | "video" | undefined;
      if (attachment) {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (!uid) throw new Error("Not signed in");
        const ext = (attachment.file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("post-media")
          .upload(path, attachment.file, {
            contentType: attachment.file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) throw upErr;
        mediaPath = path;
        mediaType = attachment.kind;
      }
      await createPost({
        data: {
          text: text.trim(),
          mediaPath,
          mediaType,
          audience,
          circleId: audience === "circle" ? circleId : null,
          mentionedUserIds: mentions.map((m) => m.userId),
        },
      });
      // Reset state
      setText("");
      setMentions([]);
      setAudience("public");
      setCircleId(null);
      clearAttachment();
      onPosted?.();
      onClose();
    } catch (e: any) {
      console.error("[PostComposerModal] post failed", e);
      setError(e?.message || "Couldn't publish. Try again.");
    } finally {
      setPosting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create post"
        className="relative w-full sm:max-w-xl sm:my-8 h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-[#141418] sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-slate-300"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-sm font-semibold text-white">Drop a post</div>
          <button
            onClick={doPost}
            disabled={!canPost}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-sm"
          >
            {posting ? (attachment ? "Uploading…" : "Posting…") : "Post"}
          </button>
        </div>

        {/* Audience picker */}
        <div className="px-4 pt-3">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setAudienceOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
            >
              {audience === "public" ? <Globe2 className="w-3.5 h-3.5" /> : audience === "followers" ? <UsersRound className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              <span>{audienceLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            {audienceOpen && (
              <div className="absolute left-0 mt-2 w-64 max-h-72 overflow-auto z-10 bg-[#1a1a20] border border-white/10 rounded-xl shadow-xl p-1">
                <AudienceOption
                  icon={<Globe2 className="w-4 h-4" />}
                  title="Public"
                  desc="Anyone on Oventric can see"
                  active={audience === "public"}
                  onClick={() => {
                    setAudience("public");
                    setCircleId(null);
                    setAudienceOpen(false);
                  }}
                />
                <AudienceOption
                  icon={<UsersRound className="w-4 h-4" />}
                  title="Followers"
                  desc="Only people who follow you"
                  active={audience === "followers"}
                  onClick={() => {
                    setAudience("followers");
                    setCircleId(null);
                    setAudienceOpen(false);
                  }}
                />
                <div className="pt-1 mt-1 border-t border-white/5">
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">Circle</div>
                  {circles.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">
                      Join a circle to share here.
                    </div>
                  ) : (
                    circles.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setAudience("circle");
                          setCircleId(c.id);
                          setAudienceOpen(false);
                        }}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-sm ${
                          audience === "circle" && circleId === c.id ? "bg-white/5" : ""
                        }`}
                      >
                        <span className="flex items-center gap-2 text-slate-200">
                          <Users className="w-4 h-4 text-emerald-400" />
                          {c.name}
                        </span>
                        {audience === "circle" && circleId === c.id && <Check className="w-4 h-4 text-emerald-400" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share an update, ask a question, drop a build log…"
            className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none text-base mt-4 min-h-[120px]"
          />

          {/* Inline action bar — kept high so it stays visible above the mobile keyboard */}
          <div className="mt-2 -mx-1 flex items-center gap-1 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={onFile}
            />
            <button
              type="button"
              onClick={onPickFile}
              disabled={posting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-white/5 text-sm"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Photo</span>
            </button>
            <button
              type="button"
              onClick={onPickFile}
              disabled={posting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-white/5 text-sm"
            >
              <VideoIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Video</span>
            </button>
            <button
              type="button"
              onClick={() => setMentionPickerOpen(true)}
              disabled={posting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-white/5 text-sm"
            >
              <AtSign className="w-4 h-4" />
              <span className="hidden sm:inline">Mention</span>
            </button>
            <div className="ml-auto text-[10px] text-slate-500 pr-2">Up to 50 MB media</div>
          </div>

          {/* Mention chips */}
          {mentions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentions.map((m) => (
                <span
                  key={m.userId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300"
                >
                  @{m.username || m.name}
                  <button
                    onClick={() => removeMention(m.userId)}
                    className="hover:text-white"
                    aria-label={`Remove mention of ${m.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Attachment preview */}
          {attachment && (
            <div className="mt-3 relative inline-block max-w-full">
              {attachment.kind === "image" ? (
                <img
                  src={attachment.previewUrl}
                  alt="Attachment preview"
                  className="max-h-80 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <video
                  src={attachment.previewUrl}
                  controls
                  className="max-h-80 rounded-lg border border-white/10"
                />
              )}
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 hover:bg-black text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
        </div>

      </div>

      {/* Mention picker overlay */}
      {mentionPickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setMentionPickerOpen(false)} />
          <div className="relative w-full max-w-md bg-[#141418] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10">
              <AtSign className="w-4 h-4 text-emerald-400" />
              <input
                autoFocus
                value={mentionQuery}
                onChange={(e) => setMentionQuery(e.target.value)}
                placeholder="Mention someone…"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={() => setMentionPickerOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Close mention search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-auto py-1">
              {mentionLoading && (
                <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </div>
              )}
              {!mentionLoading && mentionResults.length === 0 && mentionQuery.trim().length > 0 && (
                <div className="text-center text-xs text-slate-500 py-6">No matches</div>
              )}
              {!mentionLoading && mentionQuery.trim().length === 0 && (
                <div className="text-center text-xs text-slate-500 py-6">
                  Type a name or @username
                </div>
              )}
              {mentionResults.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => addMention(u)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left"
                >
                  <span className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-xs font-semibold text-white">
                    <AvatarImage
                      src={u.avatarUrl}
                      alt={u.name}
                      initials={initialsOf(u.name)}
                      className="w-full h-full flex items-center justify-center"
                    />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-100 truncate">{u.name}</span>
                    {u.username && (
                      <span className="block text-[11px] text-slate-500 truncate">@{u.username}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudienceOption({
  icon,
  title,
  desc,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-white/5 ${
        active ? "bg-white/5" : ""
      }`}
    >
      <span className="mt-0.5 text-emerald-400">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm text-slate-100">{title}</span>
        <span className="block text-[11px] text-slate-500">{desc}</span>
      </span>
      {active && <Check className="w-4 h-4 text-emerald-400 mt-1" />}
    </button>
  );
}
