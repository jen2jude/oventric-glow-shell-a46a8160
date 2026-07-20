import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitSchema = z.object({
  contact_name: z.string().trim().min(1).max(120),
  contact_email: z.string().trim().email().max(255),
  contact_phone: z.string().trim().max(60).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  tier: z.enum(["text", "image", "video"]),
  objective: z.string().trim().max(120).optional().nullable(),
  header: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional().nullable(),
  body: z.string().trim().max(1200).optional().nullable(),
  cta_type: z.string().trim().max(40).optional().nullable(),
  cta_url: z.string().trim().max(500).optional().nullable(),
  cta_whatsapp: z.string().trim().max(40).optional().nullable(),
  duration_days: z.number().int().min(1).max(365).optional().nullable(),
  daily_budget_usd: z.number().nonnegative().optional().nullable(),
  total_budget_usd: z.number().nonnegative().optional().nullable(),
  countries: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
  demographics: z.record(z.string(), z.unknown()).default({}),
  image_paths: z.array(z.string()).default([]),
  video_path: z.string().trim().max(500).optional().nullable(),
  video_url: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  acknowledged: z.literal(true),
});

export const submitAdInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => submitSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const insertRow = { ...data, user_id: userId } as unknown as never;
    const { data: inserted, error } = await supabase
      .from("ad_inquiries")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notify all admins (best-effort).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins?.length) {
        const rows = admins.map((a) => ({
          user_id: a.user_id,
          kind: "ad_inquiry",
          title: "New advert inquiry",
          body: `${data.contact_name} — ${data.tier.toUpperCase()} tier`,
          link: `/admin/ad-inquiries`,
        })) as unknown as never;
        await supabaseAdmin.from("notifications").insert(rows);
      }
    } catch { /* non-fatal */ }

    return { id: inserted.id as string };
  });

export const listAdInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ad_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { inquiries: data ?? [] };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "awaiting_funds", "active", "rejected", "archived"]).optional(),
  admin_notes: z.string().max(4000).optional().nullable(),
});

export const updateAdInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    const { error } = await supabaseAdmin.from("ad_inquiries").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
