import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
