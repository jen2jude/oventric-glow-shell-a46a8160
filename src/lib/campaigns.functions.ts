/**
 * Campaigns dashboard (Meta-Ads style, admin only).
 *
 * A campaign has 3 tiers: text | image | video. Media lives in the private
 * `ad-media` bucket and is served via signed URLs. Delivery/tracking is
 * exposed through the public RPCs `list_serving_ads`, `log_ad_event`, and
 * `submit_ad_lead`; only admins can create, edit, or view analytics.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySB = any;

async function assertAdmin(context: { supabase: AnySB; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export type CampaignTier = "text" | "image" | "video";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type CampaignCta = "url" | "whatsapp" | "lead_form";

export interface Creative {
  id: string;
  campaign_id: string;
  kind: "image" | "video";
  path: string;
  sort_order: number;
  bytes: number | null;
  duration_s: number | null;
  mime: string | null;
  url?: string;
}

export interface CampaignRow {
  id: string;
  title: string;
  advertiser: string;
  advertiser_email: string | null;
  advertiser_whatsapp: string | null;
  advertiser_user_id: string | null;
  description: string;
  status: CampaignStatus;
  tier: CampaignTier;
  header: string;
  body: string;
  placements: string[];
  cta_type: CampaignCta;
  cta_url: string;
  cta_label: string;
  cta_whatsapp: string;
  cta_lead_email: string;
  countries: string[];
  cities: string[];
  daily_budget_usd: number;
  total_budget_usd: number;
  spent_usd: number;
  escrow_locked: number;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------- Read ---------- */

export const listCampaignsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const { data, error } = await sb
      .from("ad_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CampaignRow[];
  });

export const getCampaignAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const [{ data: campaign, error: e1 }, { data: creatives, error: e2 }] = await Promise.all([
      sb.from("ad_campaigns").select("*").eq("id", data.id).single(),
      sb.from("ad_creatives").select("*").eq("campaign_id", data.id).order("sort_order"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    // sign creative URLs
    const list = (creatives ?? []) as Creative[];
    const signed = await Promise.all(
      list.map(async (c) => {
        const { data: s } = await sb.storage.from("ad-media").createSignedUrl(c.path, 60 * 60);
        return { ...c, url: s?.signedUrl };
      }),
    );
    return { campaign: campaign as CampaignRow, creatives: signed };
  });

/* ---------- Write ---------- */

export const upsertCampaignAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Partial<CampaignRow> & { id?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    if (!data.title || !data.title.trim()) throw new Error("Title is required");
    if (!data.tier || !["text", "image", "video"].includes(data.tier)) throw new Error("Invalid tier");
    if (!data.cta_type || !["url", "whatsapp", "lead_form"].includes(data.cta_type))
      throw new Error("Invalid CTA type");

    const payload: Record<string, unknown> = {
      title: data.title.trim(),
      advertiser: (data.advertiser ?? "").trim(),
      advertiser_email: data.advertiser_email ?? null,
      advertiser_whatsapp: data.advertiser_whatsapp ?? null,
      advertiser_user_id: data.advertiser_user_id ?? null,
      description: data.description ?? "",
      tier: data.tier,
      header: data.header ?? "",
      body: data.body ?? "",
      placements: data.placements ?? [],
      cta_type: data.cta_type,
      cta_url: data.cta_url ?? "",
      cta_label: data.cta_label ?? "Learn more",
      cta_whatsapp: data.cta_whatsapp ?? "",
      cta_lead_email: data.cta_lead_email ?? "",
      countries: data.countries ?? [],
      cities: data.cities ?? [],
      daily_budget_usd: Number(data.daily_budget_usd ?? 0),
      total_budget_usd: Number(data.total_budget_usd ?? 0),
      priority: Number(data.priority ?? 0),
      start_at: data.start_at ?? null,
      end_at: data.end_at ?? null,
      status: data.status ?? "draft",
    };

    if (data.id) {
      const { error } = await sb.from("ad_campaigns").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("ad_campaigns")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCampaignAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    // Refund escrow if any still locked
    await sb.rpc("end_campaign", { _id: data.id }).throwOnError?.();
    const { error } = await sb.from("ad_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "activate" | "pause" | "end" }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const rpc =
      data.action === "activate"
        ? "activate_campaign"
        : data.action === "pause"
        ? "pause_campaign"
        : "end_campaign";
    const { error } = await sb.rpc(rpc, { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Creatives ---------- */

export const listCreatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaign_id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const { data: rows, error } = await sb
      .from("ad_creatives")
      .select("*")
      .eq("campaign_id", data.campaign_id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Creative[];
    return await Promise.all(
      list.map(async (c) => {
        const { data: s } = await sb.storage.from("ad-media").createSignedUrl(c.path, 60 * 60);
        return { ...c, url: s?.signedUrl };
      }),
    );
  });

export const createCreativeUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaign_id: string; kind: "image" | "video"; extension: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const safeExt = data.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || (data.kind === "video" ? "mp4" : "jpg");
    const path = `${data.campaign_id}/${data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const { data: signed, error } = await sb.storage.from("ad-media").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const attachCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    campaign_id: string;
    kind: "image" | "video";
    path: string;
    mime?: string;
    bytes?: number;
    duration_s?: number;
    width?: number;
    height?: number;
    sort_order?: number;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    if (data.kind === "video") {
      if ((data.bytes ?? 0) > 100 * 1024 * 1024) throw new Error("Video exceeds 100MB");
      if ((data.duration_s ?? 0) > 300) throw new Error("Video exceeds 5 minutes");
    }
    const { data: row, error } = await sb
      .from("ad_creatives")
      .insert({
        campaign_id: data.campaign_id,
        kind: data.kind,
        path: data.path,
        mime: data.mime ?? null,
        bytes: data.bytes ?? null,
        duration_s: data.duration_s ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        sort_order: data.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const { data: row } = await sb.from("ad_creatives").select("path").eq("id", data.id).single();
    if (row?.path) await sb.storage.from("ad-media").remove([row.path]);
    const { error } = await sb.from("ad_creatives").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderCreatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    await Promise.all(
      data.ids.map((id, idx) => sb.from("ad_creatives").update({ sort_order: idx }).eq("id", id)),
    );
    return { ok: true };
  });

/* ---------- Analytics + reference ---------- */

export const getCampaignMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; days?: number }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const days = Math.max(1, Math.min(90, data.days ?? 14));
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const { data: rows, error } = await sb
      .from("ad_daily_spend")
      .select("day, spent_usd, impressions, clicks, leads")
      .eq("campaign_id", data.id)
      .gte("day", since)
      .order("day");
    if (error) throw new Error(error.message);
    const totals = (rows ?? []).reduce(
      (acc: { spent: number; impressions: number; clicks: number; leads: number }, r: { spent_usd: number; impressions: number; clicks: number; leads: number }) => ({
        spent: acc.spent + Number(r.spent_usd || 0),
        impressions: acc.impressions + Number(r.impressions || 0),
        clicks: acc.clicks + Number(r.clicks || 0),
        leads: acc.leads + Number(r.leads || 0),
      }),
      { spent: 0, impressions: 0, clicks: 0, leads: 0 },
    );
    return { series: rows ?? [], totals };
  });

export const listCampaignLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; limit?: number }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const { data: rows, error } = await sb
      .from("ad_leads")
      .select("*")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(500, data.limit ?? 100));
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listTargetCities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const { data, error } = await sb
      .from("ad_targets_cities")
      .select("id, country_code, city, region")
      .eq("active", true)
      .order("country_code")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addTargetCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { country_code: string; city: string; region?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as AnySB;
    const { error } = await sb.from("ad_targets_cities").upsert(
      {
        country_code: data.country_code.toUpperCase(),
        city: data.city.trim(),
        region: data.region ?? null,
      },
      { onConflict: "country_code,city" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
