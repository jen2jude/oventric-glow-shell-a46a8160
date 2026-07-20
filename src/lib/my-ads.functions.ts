/**
 * Owner-facing (advertiser) Ads Manager — VIEW ONLY.
 * Read-only endpoints for a signed-in user to view the campaigns admin
 * created on their behalf: setup, creatives, targeting, budgets, escrow,
 * spend, live metrics, URL/WhatsApp click counts, and lead capture rows.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySB = any;

export interface MyCampaignSummary {
  id: string;
  title: string;
  tier: "text" | "image" | "video";
  status: "draft" | "active" | "paused" | "ended";
  cta_type: "url" | "whatsapp" | "lead_form";
  placements: string[];
  countries: string[];
  cities: string[];
  daily_budget_usd: number;
  total_budget_usd: number;
  spent_usd: number;
  escrow_locked: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  impressions_total: number;
  clicks_total: number;
  leads_total: number;
}

export interface MyCampaignCreative {
  id: string;
  kind: "image" | "video";
  sort_order: number;
  url: string | null;
}

export interface MyCampaignDetail {
  id: string;
  title: string;
  description: string;
  tier: "text" | "image" | "video";
  status: "draft" | "active" | "paused" | "ended";
  header: string;
  body: string;
  placements: string[];
  countries: string[];
  cities: string[];
  cta_type: "url" | "whatsapp" | "lead_form";
  cta_url: string;
  cta_label: string;
  cta_whatsapp: string;
  daily_budget_usd: number;
  total_budget_usd: number;
  spent_usd: number;
  escrow_locked: number;
  escrow_remaining: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  creatives: MyCampaignCreative[];
}

export interface MyCampaignMetricsPoint {
  day: string;
  spent_usd: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface MyCampaignMetrics {
  series: MyCampaignMetricsPoint[];
  totals: { spent: number; impressions: number; clicks: number; leads: number };
  cpm: number;
  ctr: number;
  reach_estimate: number;
  clicks_by_placement: Array<{ placement: string; clicks: number }>;
  url_clicks: number;
  whatsapp_clicks: number;
}

export interface MyCampaignLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
}

/* ---------- list ---------- */

export const listMyCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyCampaignSummary[]> => {
    const sb = context.supabase as AnySB;
    const { data: campaigns, error } = await sb
      .from("ad_campaigns")
      .select(
        "id,title,tier,status,cta_type,placements,countries,cities,daily_budget_usd,total_budget_usd,spent_usd,escrow_locked,start_at,end_at,created_at",
      )
      .eq("advertiser_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (campaigns ?? []) as MyCampaignSummary[];
    if (list.length === 0) return [];

    const ids = list.map((c) => c.id);
    const { data: spendRows } = await sb
      .from("ad_daily_spend")
      .select("campaign_id, impressions, clicks, leads")
      .in("campaign_id", ids);

    const totals = new Map<string, { imp: number; clk: number; ld: number }>();
    (spendRows ?? []).forEach((r: { campaign_id: string; impressions: number; clicks: number; leads: number }) => {
      const t = totals.get(r.campaign_id) ?? { imp: 0, clk: 0, ld: 0 };
      t.imp += Number(r.impressions || 0);
      t.clk += Number(r.clicks || 0);
      t.ld += Number(r.leads || 0);
      totals.set(r.campaign_id, t);
    });

    return list.map((c) => {
      const t = totals.get(c.id) ?? { imp: 0, clk: 0, ld: 0 };
      return { ...c, impressions_total: t.imp, clicks_total: t.clk, leads_total: t.ld };
    });
  });

/* ---------- detail ---------- */

const IdIn = z.object({ id: z.string().uuid() });

export const getMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdIn.parse(i))
  .handler(async ({ data, context }): Promise<MyCampaignDetail> => {
    const sb = context.supabase as AnySB;
    const { data: c, error } = await sb
      .from("ad_campaigns")
      .select("*")
      .eq("id", data.id)
      .eq("advertiser_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Campaign not found");

    const { data: creatives } = await sb
      .from("ad_creatives")
      .select("id,kind,path,sort_order")
      .eq("campaign_id", data.id)
      .order("sort_order");

    const signed: MyCampaignCreative[] = await Promise.all(
      ((creatives ?? []) as Array<{ id: string; kind: "image" | "video"; path: string; sort_order: number }>).map(async (cr) => {
        const { data: s } = await sb.storage.from("ad-media").createSignedUrl(cr.path, 60 * 60);
        return { id: cr.id, kind: cr.kind, sort_order: cr.sort_order, url: s?.signedUrl ?? null };
      }),
    );

    const escrow = Number(c.escrow_locked || 0);
    const spent = Number(c.spent_usd || 0);
    return {
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      tier: c.tier,
      status: c.status,
      header: c.header ?? "",
      body: c.body ?? "",
      placements: c.placements ?? [],
      countries: c.countries ?? [],
      cities: c.cities ?? [],
      cta_type: c.cta_type,
      cta_url: c.cta_url ?? "",
      cta_label: c.cta_label ?? "",
      cta_whatsapp: c.cta_whatsapp ?? "",
      daily_budget_usd: Number(c.daily_budget_usd || 0),
      total_budget_usd: Number(c.total_budget_usd || 0),
      spent_usd: spent,
      escrow_locked: escrow,
      escrow_remaining: Math.max(escrow - spent, 0),
      start_at: c.start_at,
      end_at: c.end_at,
      created_at: c.created_at,
      creatives: signed,
    };
  });

/* ---------- metrics ---------- */

const MetricsIn = z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(90).optional() });

export const getMyCampaignMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MetricsIn.parse(i))
  .handler(async ({ data, context }): Promise<MyCampaignMetrics> => {
    const sb = context.supabase as AnySB;
    // Enforce ownership: only return metrics for campaigns owned by this user.
    const { data: own } = await sb
      .from("ad_campaigns")
      .select("id")
      .eq("id", data.id)
      .eq("advertiser_user_id", context.userId)
      .maybeSingle();
    if (!own) throw new Error("Campaign not found");

    const days = Math.max(1, Math.min(90, data.days ?? 30));
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();

    const [{ data: spend }, { data: events }] = await Promise.all([
      sb
        .from("ad_daily_spend")
        .select("day, spent_usd, impressions, clicks, leads")
        .eq("campaign_id", data.id)
        .gte("day", since)
        .order("day"),
      sb
        .from("ad_events")
        .select("kind, placement, user_id, session_id")
        .eq("campaign_id", data.id)
        .gte("occurred_at", sinceIso),
    ]);

    const series = (spend ?? []) as MyCampaignMetricsPoint[];
    const totals = series.reduce(
      (acc, r) => ({
        spent: acc.spent + Number(r.spent_usd || 0),
        impressions: acc.impressions + Number(r.impressions || 0),
        clicks: acc.clicks + Number(r.clicks || 0),
        leads: acc.leads + Number(r.leads || 0),
      }),
      { spent: 0, impressions: 0, clicks: 0, leads: 0 },
    );

    const clicksByPlacement = new Map<string, number>();
    const reachIds = new Set<string>();
    (events ?? []).forEach((e: { kind: string; placement: string | null; user_id: string | null; session_id: string | null }) => {
      const key = e.user_id ?? e.session_id ?? "";
      if (e.kind === "impression" && key) reachIds.add(key);
      if (e.kind === "click") {
        const p = e.placement ?? "other";
        clicksByPlacement.set(p, (clicksByPlacement.get(p) ?? 0) + 1);
      }
    });

    // We don't split click type per event; infer by campaign cta_type from caller side.
    const { data: c2 } = await sb
      .from("ad_campaigns")
      .select("cta_type")
      .eq("id", data.id)
      .single();
    const url_clicks = c2?.cta_type === "url" ? totals.clicks : 0;
    const whatsapp_clicks = c2?.cta_type === "whatsapp" ? totals.clicks : 0;

    const cpm = totals.impressions > 0 ? (totals.spent / totals.impressions) * 1000 : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

    return {
      series,
      totals,
      cpm: Number(cpm.toFixed(3)),
      ctr: Number(ctr.toFixed(2)),
      reach_estimate: reachIds.size,
      clicks_by_placement: Array.from(clicksByPlacement.entries())
        .map(([placement, clicks]) => ({ placement, clicks }))
        .sort((a, b) => b.clicks - a.clicks),
      url_clicks,
      whatsapp_clicks,
    };
  });

/* ---------- leads ---------- */

const LeadsIn = z.object({ id: z.string().uuid(), limit: z.number().int().min(1).max(500).optional() });

export const listMyCampaignLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LeadsIn.parse(i))
  .handler(async ({ data, context }): Promise<MyCampaignLead[]> => {
    const sb = context.supabase as AnySB;
    const { data: own } = await sb
      .from("ad_campaigns")
      .select("id")
      .eq("id", data.id)
      .eq("advertiser_user_id", context.userId)
      .maybeSingle();
    if (!own) throw new Error("Campaign not found");

    const { data: rows, error } = await sb
      .from("ad_leads")
      .select("id,name,email,phone,message,created_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as MyCampaignLead[];
  });
