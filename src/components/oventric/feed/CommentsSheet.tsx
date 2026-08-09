import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Send, CornerDownRight } from "lucide-react";
import {
  listComments,
  addComment,
  setCommentReaction,
  type FeedComment,
} from "@/lib/comments.functions";
import { REACTION_META, REACTION_ORDER, ReactionPicker, ReactionButton } from "./Reactions";
import type { ReactionType } from "@/lib/posts.functions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { toast } from "sonner";

interface Props {
  postId: string;
  postAuthorName: string;
  onClose: () => void;
  viewerName?: string;
  viewerInitials?: string;
}

function Comment({
  c,
  replies,
  onReply,
  onReact,
}: {
  c: FeedComment;
  replies: FeedComment[];
  onReply: (parent: FeedComment) => void;
  onReact: (id: string, r: ReactionType | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const total = c.reactions.love + c.reactions.like + c.reactions.laugh + c.reactions.crown;
  const viewer = c.viewer_reaction;
  return (
    <div className="flex gap-2.5 py-2">
      <div className="w-8 h-8 shrink-0 rounded-full bg-[#E5484D]/20 border border-[#E5484D]/40 flex items-center justify-center text-emerald-300 md:text-emerald-700 text-[11px] font-semibold">
        {c.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-white/5 md:bg-slate-100 border border-white/10 md:border-slate-200 px-3 py-2">
          <div className="text-[12px] font-semibold text-slate-200 md:text-slate-700 truncate">
            {c.author_name}
          </div>
          <div className="text-[13px] text-slate-100 md:text-slate-800 whitespace-pre-wrap break-words">
            {c.text}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1 pl-1 relative">
          <div className="flex items-center gap-1.5">
            <ReactionButton
              reaction={viewer ?? "love"}
              size="xs"
              ariaLabel={viewer ? REACTION_META[viewer].label : "React"}
              onClick={() => (viewer ? onReact(c.id, null) : setPickerOpen((v) => !v))}
            />
            {viewer && (
              <span
                className="text-[11px] font-medium"
                style={{ color: REACTION_META[viewer].color }}
              >
                {REACTION_META[viewer].label}
              </span>
            )}
          </div>
          {total > 0 && (
            <span className="text-[11px] text-slate-500 md:text-slate-500">
              {total} {total === 1 ? "reaction" : "reactions"}
            </span>
          )}
          <button
            type="button"
            onClick={() => onReply(c)}
            className="text-[11px] text-slate-400 md:text-slate-600 hover:text-emerald-300 md:hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <CornerDownRight className="w-3.5 h-3.5" /> Reply
          </button>
          <span className="text-[11px] text-slate-500 md:text-slate-500 ml-auto">
            {new Date(c.created_at).toLocaleString()}
          </span>
          {pickerOpen && (
            <ReactionPicker
              onPick={(r) => {
                onReact(c.id, r);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        {replies.length > 0 && (
          <div className="mt-1 pl-3 border-l border-white/10 md:border-slate-200">
            {replies.map((r) => (
              <Comment key={r.id} c={r} replies={[]} onReply={onReply} onReact={onReact} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsSheet({
  postId,
  postAuthorName,
  onClose,
  viewerName,
  viewerInitials,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listComments);
  const addFn = useServerFn(addComment);
  const reactFn = useServerFn(setCommentReaction);
  const { require } = useOnboarding();

  const { data } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => listFn({ data: { postId } }),
    staleTime: 15_000,
  });
  const comments = (data?.comments ?? []) as FeedComment[];
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, FeedComment[]>();
  comments.forEach((c) => {
    if (c.parent_id) {
      const arr = repliesMap.get(c.parent_id) ?? [];
      arr.push(c);
      repliesMap.set(c.parent_id, arr);
    }
  });

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const addMut = useMutation({
    mutationFn: (payload: { text: string; parentId: string | null }) =>
      addFn({
        data: {
          postId,
          text: payload.text,
          authorName: viewerName || "You",
          initials: viewerInitials || "YO",
          parentId: payload.parentId,
        },
      }),
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to post comment"),
  });

  const reactMut = useMutation({
    mutationFn: (v: { commentId: string; reaction: ReactionType | null }) => reactFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      const prev = qc.getQueryData<{ comments: FeedComment[] }>(["comments", postId]);
      if (prev) {
        qc.setQueryData(["comments", postId], {
          comments: prev.comments.map((c) => {
            if (c.id !== v.commentId) return c;
            const nx = { ...c.reactions };
            if (c.viewer_reaction) nx[c.viewer_reaction] = Math.max(0, nx[c.viewer_reaction] - 1);
            if (v.reaction) nx[v.reaction] += 1;
            return { ...c, reactions: nx, viewer_reaction: v.reaction };
          }),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["comments", postId], ctx.prev);
      toast.error("Reaction failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["comments", postId] }),
  });

  const handleSubmit = () => {
    const t = text.trim();
    if (!t) return;
    require(2, () => addMut.mutate({ text: t, parentId: replyTo?.id ?? null }), "interaction");
  };

  return (
    <div
      className="modal-light fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg h-[85vh] sm:h-[75vh] bg-[#141416] md:bg-white border border-white/10 md:border-slate-200 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden slide-up"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 md:border-slate-200 shrink-0">
          <div>
            <div className="text-sm font-semibold text-slate-100 md:text-slate-800">Comments</div>
            <div className="text-[11px] text-slate-500 md:text-slate-500">
              on {postAuthorName}'s post
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 md:hover:bg-slate-100 text-slate-300 md:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-3 border-b border-white/10 md:border-slate-200 bg-white/5 md:bg-slate-100 shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400 md:text-slate-600">
              <span>Replying to {replyTo.author_name}</span>
              <button
                className="hover:text-slate-200 md:hover:text-slate-800"
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
              rows={1}
              className="flex-1 resize-none rounded-2xl bg-[#0f0f11] md:bg-slate-50 border border-white/10 md:border-slate-200 px-3 py-2 text-[13px] text-slate-100 md:text-slate-800 outline-none focus:border-[#E5484D]/60 max-h-32"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || addMut.isPending}
              className="p-2 rounded-full bg-[#E5484D] text-black disabled:opacity-40 hover:bg-[#E5484D]"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {topLevel.length === 0 ? (
            <div className="text-center text-slate-500 md:text-slate-500 text-sm py-10">
              No comments yet — be first.
            </div>
          ) : (
            topLevel.map((c) => (
              <Comment
                key={c.id}
                c={c}
                replies={repliesMap.get(c.id) ?? []}
                onReply={(p) => {
                  setReplyTo(p);
                  inputRef.current?.focus();
                }}
                onReact={(id, r) =>
                  require(2, () => reactMut.mutate({ commentId: id, reaction: r }), "interaction")
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
