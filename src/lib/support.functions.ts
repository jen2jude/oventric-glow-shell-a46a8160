import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TicketInput = z.object({
  category: z.string().trim().min(2).max(60),
  subject: z.string().trim().min(3).max(140),
  details: z.string().trim().min(5).max(2000),
});

export const submitSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TicketInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_tickets").insert({
      user_id: context.userId,
      category: data.category,
      subject: data.subject,
      details: data.details,
    });
    if (error) throw new Error("Could not open the dispute. Try again.");
    return { ok: true as const };
  });

export const listMySupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("support_tickets")
      .select("id, category, subject, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

const FeedbackInput = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(3).max(1200),
  topic: z.string().trim().max(80).optional().nullable(),
});

export const submitSupportFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => FeedbackInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_feedback").insert({
      user_id: context.userId,
      rating: data.rating,
      message: data.message,
      topic: data.topic ?? null,
    });
    if (error) throw new Error("Could not send your feedback.");
    return { ok: true as const };
  });

export const listMySupportChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("support_chat_messages")
      .select("id, sender, body, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return data ?? [];
  });

export const sendSupportChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ body: z.string().trim().min(1).max(1200) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_chat_messages").insert({
      user_id: context.userId,
      sender: "user",
      body: data.body,
    });
    if (error) throw new Error("Message not sent.");
    return { ok: true as const };
  });
