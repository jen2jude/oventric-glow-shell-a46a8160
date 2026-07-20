/**
 * Public ad delivery: wraps the `list_serving_ads` RPC and signs creative
 * paths from the private `ad-media` bucket so anonymous users can see them.
 * Tracking (`log_ad_event`) and lead submission (`submit_ad_lead`) are called
 * directly from the browser via the anon RPC path.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AdTierRpc = "text" | "image" | "video";
export type AdCtaType = "url" | "whatsapp" | "lead_form";
export type AdPlacement = "feed" | "marketplace" | "academy" | "bounties";

export interface ServingCreative {
  id: string;
  kind: "image" | "video";
  sort_order: number;
  url: string | null;
}

export interface ServingAd {
  id: string;
  tier: AdTierRpc;
  header: string;
  description: string;
  body: string;
  cta_type: AdCtaType;
  cta_label: string;
  cta_url: string;
  cta_whatsapp: string;
  priority: number;
  creatives: ServingCreative[];
}

const Input = z.object({
  placement: z.enum(["feed", "marketplace", "academy", "bounties"]),
  country: z.string().max(4).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const getServingAds = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<ServingAd[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("list_serving_ads", {
      _placement: data.placement,
      _country: data.country ?? undefined,
      _city: data.city ?? undefined,
      _limit: data.limit ?? 5,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[ads] list_serving_ads error", error);
      return [];
    }
    const list = (rows ?? []) as Array<{
      id: string;
      tier: string;
      header: string;
      description: string;
      body: string;
      cta_type: string;
      cta_label: string;
      cta_url: string;
      cta_whatsapp: string;
      priority: number;
      creatives: Array<{ id: string; kind: string; path: string; sort_order: number }> | null;
    }>;

    // Collect unique creative paths and sign in one batch.
    const paths = Array.from(
      new Set(
        list.flatMap((c) => (c.creatives ?? []).map((cr) => cr.path).filter(Boolean)),
      ),
    );
    const urlByPath = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("ad-media")
        .createSignedUrls(paths, 60 * 60 * 6);
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
      });
    }

    return list.map((c) => ({
      id: c.id,
      tier: (c.tier as AdTierRpc) ?? "text",
      header: c.header ?? "",
      description: c.description ?? "",
      body: c.body ?? "",
      cta_type: (c.cta_type as AdCtaType) ?? "url",
      cta_label: c.cta_label ?? "Learn more",
      cta_url: c.cta_url ?? "",
      cta_whatsapp: c.cta_whatsapp ?? "",
      priority: c.priority ?? 0,
      creatives: (c.creatives ?? []).map((cr) => ({
        id: cr.id,
        kind: (cr.kind as "image" | "video") ?? "image",
        sort_order: cr.sort_order ?? 0,
        url: urlByPath.get(cr.path) ?? null,
      })),
    }));
  });
