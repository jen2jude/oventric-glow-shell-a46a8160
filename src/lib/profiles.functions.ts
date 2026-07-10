import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type {
  ProfileBounty,
  ProfileGroup,
  ProfileListing,
  ProfilePost,
} from "./profiles/mockProfiles";

const TabEnum = z.enum(["posts", "groups", "marketplace", "posted", "solved"]);
const SortEnum = z.enum([
  "newest",
  "most_liked",
  "most_commented",
  "most_members",
  "alpha",
  "price_low",
  "price_high",
  "most_sold",
  "highest_bounty",
  "lowest_bounty",
  "most_applicants",
]);
export type ProfileSortKey = z.infer<typeof SortEnum>;

const TabInput = z.object({
  profileId: z.string().trim().min(1).max(120),
  tab: TabEnum,
  page: z.number().int().min(1).max(200).default(1),
  pageSize: z.number().int().min(1).max(50).default(6),
  q: z.string().trim().max(120).optional().default(""),
  sort: SortEnum.optional().default("newest"),
});

export type ProfileTabItem =
  | ProfilePost
  | ProfileGroup
  | ProfileListing
  | ProfileBounty;

export interface ProfileTabPage {
  items: ProfileTabItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const getProfileTab = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TabInput.parse(input))
  .handler(async ({ data }): Promise<ProfileTabPage> => {
    const { loadProfileTab } = await import("@/lib/profiles/data.server");
    // Small artificial latency so pagination UX is observable in the demo.
    await new Promise((r) => setTimeout(r, 120));
    return loadProfileTab(data.profileId, data.tab, data.page, data.pageSize, {
      q: data.q,
      sort: data.sort,
    });
  });


const KindEnum = z.enum(["post", "group", "listing", "bounty", "solved"]);
const ItemInput = z.object({
  profileId: z.string().trim().min(1).max(120),
  kind: KindEnum,
  itemId: z.string().trim().min(1).max(200),
});

export type ProfileItemKind = z.infer<typeof KindEnum>;

export const getProfileItem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ItemInput.parse(input))
  .handler(async ({ data }): Promise<{ item: ProfileTabItem | null }> => {
    const { loadProfileItem } = await import("@/lib/profiles/data.server");
    const item = loadProfileItem(data.profileId, data.kind, data.itemId);
    return { item };
  });


// ---------------------------------------------------------------------------
// Real profile view (by user_id UUID or slug/username). Falls back cleanly
// when nothing matches so the route can render an empty state.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RealProfileView {
  userId: string;
  slug: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verificationTier: string;
  reputationStars: number;
  country: string | null;
  joined: string; // ISO
}

const ViewInput = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

export const getProfileByIdOrSlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ViewInput.parse(input))
  .handler(async ({ data }): Promise<{ profile: RealProfileView | null }> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const looksLikeUuid = UUID_RE.test(data.idOrSlug);
    const query = supabase
      .from("profiles")
      .select(
        "user_id, slug, display_name, username, bio, avatar_path, verification_tier, reputation_stars, created_at",
      )
      .limit(1);

    const { data: row, error } = looksLikeUuid
      ? await query.eq("user_id", data.idOrSlug).maybeSingle()
      : await query.or(`slug.eq.${data.idOrSlug},username.eq.${data.idOrSlug}`).maybeSingle();

    if (error) {
      console.error("[getProfileByIdOrSlug] read failed", error);
      return { profile: null };
    }
    if (!row) return { profile: null };

    // Sign the avatar path (bucket is private).
    let avatarUrl: string | null = null;
    if (row.avatar_path) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(row.avatar_path, 60 * 60 * 24 * 7);
      avatarUrl = signed?.signedUrl ?? null;
    }

    return {
      profile: {
        userId: row.user_id,
        slug: row.slug,
        displayName: row.display_name ?? row.username ?? row.slug,
        username: row.username,
        bio: row.bio,
        avatarUrl,
        verificationTier: row.verification_tier,
        reputationStars: Number(row.reputation_stars ?? 0),
        country: null,
        joined: row.created_at,
      },
    };
  });


// ---------------------------------------------------------------------------
// Update the authenticated user's own profile (name, bio, avatar path).
// ---------------------------------------------------------------------------

const UpdateInput = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(280).optional().nullable(),
  avatarPath: z.string().trim().max(300).optional().nullable(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([(await import("@/integrations/supabase/auth-middleware")).requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.avatarPath !== undefined) patch.avatar_path = data.avatarPath;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) {
      console.error("[updateMyProfile] update failed", error);
      throw new Error("Failed to update profile");
    }
    return { ok: true };
  });

