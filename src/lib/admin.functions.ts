import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: ReturnType<typeof Object>; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function writeAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  actorId: string,
  action: string,
  targetKind: string | null,
  targetId: string | null,
  meta: Record<string, unknown> = {},
) {
  await sb.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_kind: targetKind,
    target_id: targetId,
    meta,
  });
}

/** Check if the current user is an admin. Never throws — returns false if not signed in. */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: Boolean(data) };
  });

/** Aggregate stats for the admin overview page. */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const [users, products, orders, activeCampaigns, pendingReports, bounties] = await Promise.all([
      sb.from("profiles").select("*", { count: "exact", head: true }),
      sb.from("products").select("*", { count: "exact", head: true }),
      sb.from("orders").select("total_usd, status", { count: "exact" }),
      sb.from("ad_campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("post_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("wallet_transactions").select("*", { count: "exact", head: true }),
    ]);

    const paid = ((orders.data ?? []) as Array<{ total_usd: number; status: string }>).filter(
      (o) => o.status === "paid",
    );
    const revenueUsd = paid.reduce((s, o) => s + Number(o.total_usd ?? 0), 0);

    return {
      users: users.count ?? 0,
      products: products.count ?? 0,
      orders: orders.count ?? 0,
      revenueUsd,
      activeCampaigns: activeCampaigns.count ?? 0,
      pendingReports: pendingReports.count ?? 0,
      transactions: bounties.count ?? 0,
    };
  });

/** Recent activity across the platform. */
export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [orders, users, products, audit] = await Promise.all([
      sb.from("orders").select("id, total_usd, status, created_at, product_id").order("created_at", { ascending: false }).limit(8),
      sb.from("profiles").select("user_id, username, created_at").order("created_at", { ascending: false }).limit(8),
      sb.from("products").select("id, name, price_usd, created_at").order("created_at", { ascending: false }).limit(8),
      sb.from("audit_logs").select("id, action, target_kind, target_id, created_at").order("created_at", { ascending: false }).limit(15),
    ]);
    return {
      orders: orders.data ?? [],
      users: users.data ?? [],
      products: products.data ?? [],
      audit: audit.data ?? [],
    };
  });

/** ------- Users ------- */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("user_id, username, display_name, country, verification_tier, reputation_stars, suspended, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const { data: roles } = await sb.from("user_roles").select("user_id, role");
    const rmap = new Map<string, string[]>();
    ((roles ?? []) as Array<{ user_id: string; role: string }>).forEach((r) => {
      const arr = rmap.get(r.user_id) ?? [];
      arr.push(r.role);
      rmap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      roles: rmap.get(p.user_id as string) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; role: "admin" | "moderator" | "user"; grant: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (data.grant) {
      await sb.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await sb.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    await writeAudit(sb, context.userId, `role.${data.grant ? "grant" : "revoke"}`, "user", data.userId, { role: data.role });
    return { ok: true };
  });

/** ------- Products moderation ------- */
export const listAllProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("products")
      .select("id, name, category, vendor, price_usd, promoted, seller_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteProductAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.delete", "product", data.id);
    return { ok: true };
  });

export const setProductPromoted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; promoted: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("products").update({ promoted: data.promoted }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, `product.${data.promoted ? "promote" : "unpromote"}`, "product", data.id);
    return { ok: true };
  });

/** Admin creates a marketplace product. Ownership defaults to the admin unless overridden. */
export const adminCreateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    name: string;
    category: string;
    description?: string;
    price_usd: number;
    vendor: string;
    hue?: string;
    external_url?: string | null;
    file_path?: string | null;
    cover_path?: string | null;
    promoted?: boolean;
    seller_id?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (!data.name?.trim()) throw new Error("Name required");
    if (!(Number(data.price_usd) > 0)) throw new Error("Price must be > 0");
    const { data: row, error } = await sb
      .from("products")
      .insert({
        seller_id: data.seller_id || context.userId,
        name: data.name.trim(),
        category: data.category,
        description: data.description ?? "",
        price_usd: Number(data.price_usd),
        vendor: data.vendor.trim(),
        hue: data.hue ?? "from-emerald-500 to-teal-700",
        external_url: data.external_url ?? null,
        file_path: data.file_path ?? null,
        cover_path: data.cover_path ?? null,
        promoted: data.promoted ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.create", "product", row.id as string);
    return { id: row.id as string };
  });

/** Admin updates any product (works for products owned by other users via admin RLS). */
export const adminUpdateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    name?: string;
    category?: string;
    description?: string;
    price_usd?: number;
    vendor?: string;
    hue?: string;
    external_url?: string | null;
    promoted?: boolean;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.category !== undefined) patch.category = data.category;
    if (data.description !== undefined) patch.description = data.description;
    if (data.price_usd !== undefined) patch.price_usd = Number(data.price_usd);
    if (data.vendor !== undefined) patch.vendor = data.vendor.trim();
    if (data.hue !== undefined) patch.hue = data.hue;
    if (data.external_url !== undefined) patch.external_url = data.external_url;
    if (data.promoted !== undefined) patch.promoted = data.promoted;
    const { error } = await sb.from("products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "product.update", "product", data.id, patch);
    return { ok: true };
  });

/** ------- Campaigns ------- */
export interface AdCampaignRow {
  id: string;
  title: string;
  advertiser: string;
  description: string;
  status: "active" | "paused" | "ended" | "draft";
  tier: "text" | "image" | "video";
  header: string;
  body: string;
  media_path: string | null;
  media_url: string | null;
  placements: string[];
  cta_type: string;
  cta_url: string;
  cta_label: string;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("ad_campaigns").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AdCampaignRow[];
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Partial<AdCampaignRow> & { id?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { error } = await sb.from("ad_campaigns").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(sb, context.userId, "campaign.update", "campaign", data.id);
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("ad_campaigns").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "campaign.create", "campaign", row.id as string);
    return { id: row.id as string };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("ad_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "campaign.delete", "campaign", data.id);
    return { ok: true };
  });

/** ------- Categories ------- */
export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("marketplace_categories").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string; slug: string; name: string; description?: string; sort_order?: number; enabled?: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("marketplace_categories").update({
        slug: data.slug, name: data.name, description: data.description ?? "",
        sort_order: data.sort_order ?? 0, enabled: data.enabled ?? true,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(sb, context.userId, "category.update", "category", data.id);
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("marketplace_categories").insert({
      slug: data.slug, name: data.name, description: data.description ?? "",
      sort_order: data.sort_order ?? 0, enabled: data.enabled ?? true,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "category.create", "category", row.id as string);
    return { id: row.id as string };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("marketplace_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "category.delete", "category", data.id);
    return { ok: true };
  });

/** ------- Feature flags ------- */
export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("feature_flags").select("*").order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; enabled: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("feature_flags").update({ enabled: data.enabled, updated_by: context.userId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, `feature.${data.enabled ? "enable" : "disable"}`, "feature_flag", data.id);
    return { ok: true };
  });

/** ------- Audit logs ------- */
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** ------- Platform settings ------- */
export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { base_currency?: string; live_fx_enabled?: boolean; fx_rates?: Record<string, number> }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.base_currency !== undefined) patch.base_currency = data.base_currency;
    if (data.live_fx_enabled !== undefined) patch.live_fx_enabled = data.live_fx_enabled;
    if (data.fx_rates !== undefined) {
      patch.fx_rates = data.fx_rates;
      patch.fx_updated_at = new Date().toISOString();
    }
    const { error } = await sb.from("platform_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "settings.update", "platform_settings", "1", patch);
    return { ok: true };
  });
