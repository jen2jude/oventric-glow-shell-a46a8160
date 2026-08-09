import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AboutEntry {
  title: string;
  subtitle?: string;
  year?: string;
}

export interface ProfileAbout {
  userId: string | null;
  story: string | null;
  joined: string | null;
  education: AboutEntry[];
  certifications: AboutEntry[];
  languages: string[];
  /** Platform-wide achievement tallies used by the horizontal stat rail. */
  stats: {
    yearsOnPlatform: number;
    bountiesSolved: number;
    bountiesPosted: number;
    productsSold: number;
    servicesRendered: number;
    coursesSold: number;
    coursesCompleted: number;
    productsListed: number;
    servicesListed: number;
    postsPublished: number;
    followers: number;
    communities: number;
    happyClients: number;
    projectsCompleted: number;
  };
  /** Lifetime gross earnings in USD; the UI converts to the viewer's currency. */
  earnedUsd: number;
}

const EMPTY_STATS: ProfileAbout["stats"] = {
  yearsOnPlatform: 0,
  bountiesSolved: 0,
  bountiesPosted: 0,
  productsSold: 0,
  servicesRendered: 0,
  coursesSold: 0,
  coursesCompleted: 0,
  productsListed: 0,
  servicesListed: 0,
  postsPublished: 0,
  followers: 0,
  communities: 0,
  happyClients: 0,
  projectsCompleted: 0,
};

function toEntries(value: unknown): AboutEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const title = typeof r["title"] === "string" ? r["title"].trim() : "";
      if (!title) return null;
      return {
        title: title.slice(0, 120),
        subtitle: typeof r["subtitle"] === "string" ? r["subtitle"].trim().slice(0, 160) : "",
        year: typeof r["year"] === "string" ? r["year"].trim().slice(0, 24) : "",
      } satisfies AboutEntry;
    })
    .filter((e): e is AboutEntry => !!e)
    .slice(0, 20);
}

const Input = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

/** Public read: story, credentials and lifetime achievement tallies. */
export const getProfileAbout = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ProfileAbout> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const q = supabaseAdmin
      .from("profiles")
      .select("user_id, bio, created_at, education, certifications, languages")
      .limit(1);
    const { data: prof } = UUID_RE.test(data.idOrSlug)
      ? await q.eq("user_id", data.idOrSlug).maybeSingle()
      : await q.or(`slug.eq.${data.idOrSlug},username.eq.${data.idOrSlug}`).maybeSingle();

    if (!prof) {
      return {
        userId: null,
        story: null,
        joined: null,
        education: [],
        certifications: [],
        languages: [],
        stats: EMPTY_STATS,
        earnedUsd: 0,
      };
    }

    const userId = prof.user_id as string;
    const row = prof as unknown as Record<string, unknown>;
    const head = { count: "exact" as const, head: true };
    const PAID = ["paid", "released", "delivered", "completed"];

    const { data: courseRows } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("owner_id", userId);
    const courseIds = (courseRows ?? []).map((c) => c.id as string);

    const [
      productsSold,
      servicesRendered,
      coursesCompleted,
      bountiesSolved,
      bountiesPosted,
      productsListed,
      servicesListed,
      posts,
      followers,
      communities,
    ] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id", head)
        .eq("seller_id", userId)
        .is("service_package_id", null)
        .in("status", PAID),
      supabaseAdmin
        .from("orders")
        .select("id", head)
        .eq("seller_id", userId)
        .not("service_package_id", "is", null)
        .in("status", PAID),
      supabaseAdmin
        .from("course_enrollments")
        .select("id", head)
        .eq("user_id", userId)
        .not("completed_at", "is", null),
      supabaseAdmin
        .from("bounties")
        .select("id", head)
        .eq("accepted_applicant_id", userId)
        .eq("status", "solved"),
      supabaseAdmin.from("bounties").select("id", head).eq("poster_id", userId),
      supabaseAdmin
        .from("products")
        .select("id", head)
        .eq("seller_id", userId)
        .neq("kind", "service"),
      supabaseAdmin.from("products").select("id", head).eq("seller_id", userId).eq("kind", "service"),
      supabaseAdmin.from("posts").select("id", head).eq("author_id", userId),
      supabaseAdmin.from("follows").select("follower_id", head).eq("following_id", userId),
      supabaseAdmin.from("circle_members").select("circle_id", head).eq("user_id", userId),
    ]);

    let coursesSold = 0;
    let courseRevenue = 0;
    if (courseIds.length > 0) {
      const { data: enr } = await supabaseAdmin
        .from("course_enrollments")
        .select("amount_paid_usd")
        .in("course_id", courseIds);
      coursesSold = enr?.length ?? 0;
      courseRevenue = (enr ?? []).reduce((sum, e) => sum + Number(e.amount_paid_usd ?? 0), 0);
    }

    const { data: soldRows } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, total_usd, seller_share_usd")
      .eq("seller_id", userId)
      .in("status", PAID);
    const orderRevenue = (soldRows ?? []).reduce(
      (sum, o) => sum + Number(o.seller_share_usd ?? o.total_usd ?? 0),
      0,
    );
    const happyClients = new Set((soldRows ?? []).map((o) => o.buyer_id as string)).size;

    const { data: wonBounties } = await supabaseAdmin
      .from("bounties")
      .select("price_usd")
      .eq("accepted_applicant_id", userId)
      .eq("status", "solved");
    const bountyRevenue = (wonBounties ?? []).reduce((s, b) => s + Number(b.price_usd ?? 0), 0);

    const joined = (row["created_at"] as string) ?? null;
    const years = joined
      ? Math.max(0, Math.floor((Date.now() - new Date(joined).getTime()) / 31557600000))
      : 0;

    const solved = bountiesSolved.count ?? 0;
    const services = servicesRendered.count ?? 0;

    return {
      userId,
      story: (row["bio"] as string) ?? null,
      joined,
      education: toEntries(row["education"]),
      certifications: toEntries(row["certifications"]),
      languages: Array.isArray(row["languages"])
        ? (row["languages"] as unknown[]).filter((l): l is string => typeof l === "string")
        : [],
      stats: {
        yearsOnPlatform: years,
        bountiesSolved: solved,
        bountiesPosted: bountiesPosted.count ?? 0,
        productsSold: productsSold.count ?? 0,
        servicesRendered: services,
        coursesSold,
        coursesCompleted: coursesCompleted.count ?? 0,
        productsListed: productsListed.count ?? 0,
        servicesListed: servicesListed.count ?? 0,
        postsPublished: posts.count ?? 0,
        followers: followers.count ?? 0,
        communities: communities.count ?? 0,
        happyClients,
        projectsCompleted: solved + services,
      },
      earnedUsd: Math.round((orderRevenue + courseRevenue + bountyRevenue) * 100) / 100,
    };
  });

const EntryInput = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(160).optional().default(""),
  year: z.string().trim().max(24).optional().default(""),
});

const SaveInput = z.object({
  education: z.array(EntryInput).max(20).optional(),
  certifications: z.array(EntryInput).max(20).optional(),
  languages: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
});

/** Owner-only write for the About tab credentials. */
export const saveMyAbout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.education) patch["education"] = data.education;
    if (data.certifications) patch["certifications"] = data.certifications;
    if (data.languages) patch["languages"] = data.languages;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[saveMyAbout] update failed", error);
      throw new Error("Failed to save about details");
    }
    return { ok: true };
  });
