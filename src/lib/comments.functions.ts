import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  postId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
  authorName: z.string().trim().min(1).max(80).default("Guest"),
  initials: z.string().trim().min(1).max(4).default("OV"),
});

export interface FeedComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  initials: string;
  text: string;
  created_at: string;
}

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("post_comments")
      .select("id, post_id, author_id, author_name, initials, text, created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[listComments] failed", error);
      throw new Error("Failed to load comments");
    }
    return { comments: (rows ?? []) as FeedComment[] };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("post_comments")
      .insert({
        post_id: data.postId,
        author_id: context.userId,
        author_name: data.authorName,
        initials: data.initials,
        text: data.text,
      })
      .select("id, post_id, author_id, author_name, initials, text, created_at")
      .single();
    if (error) {
      console.error("[addComment] insert failed", error);
      throw new Error("Failed to post comment");
    }
    return { comment: row as FeedComment };
  });

export const updateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      text: z.string().trim().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("post_comments")
      .update({ text: data.text })
      .eq("id", data.id)
      .eq("author_id", context.userId)
      .select("id, post_id, author_id, author_name, initials, text, created_at")
      .single();
    if (error || !row) {
      console.error("[updateComment] failed", error);
      throw new Error("Failed to update comment");
    }
    return { comment: row as FeedComment };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_comments")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId);
    if (error) {
      console.error("[deleteComment] failed", error);
      throw new Error("Failed to delete comment");
    }
    return { id: data.id };
  });
