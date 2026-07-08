// Server-only profile data source. Not client-reachable.
import { getProfile, type Profile, type ProfilePost, type ProfileGroup, type ProfileListing, type ProfileBounty } from "./mockProfiles";

// Deterministic hash for repeatable "totals" per profile+tab
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const categories = ["Themes", "Plugins", "HTML Blocks", "Scripts"] as const;
const groupTags = ["Community", "Infra", "Database", "AI", "Frontend", "Architecture"] as const;
const groupNames = [
  "Indie Hackers",
  "Postgres Power Users",
  "Edge Runtime Builders",
  "TanStack Circle",
  "Design Engineers",
  "Bounty Hunters Guild",
  "AI Toolsmiths",
  "SaaS Architects",
  "Web Performance Nerds",
  "Open Source Maintainers",
];
const postSeeds = [
  "Shipped a new pipeline that cut our p95 latency by 42%.",
  "Hot take: most 'realtime' features are polling with extra steps.",
  "Bounty complete — thanks to the reviewers who caught the RLS gap.",
  "Working on a lightweight audit-log middleware. Alpha next week.",
  "The best DX is the one that stays out of your way.",
  "Open-sourced my Tailwind design tokens. Link in bio.",
  "Postgres advisory locks are still underrated in 2026.",
  "New course dropping: end-to-end typed server functions.",
  "Refactored our checkout to server functions — 60% less client JS.",
  "Debugging distributed systems is 90% good log correlation.",
];
const listingSeeds = [
  "Starter Template Kit",
  "Multi-tenant Schema Blueprint",
  "Auth Flow Boilerplate",
  "Dashboard Analytics Pack",
  "Payment Webhook Handler",
  "Landing Page Set",
  "Email Template Suite",
  "Admin Console Blocks",
  "SEO Meta Toolkit",
  "Realtime Chat Module",
];
const bountyOpenSeeds = [
  "Convert Prisma schema to Drizzle",
  "Write a pgvector migration tool",
  "Build a headless invoice engine",
  "Design a rate-limit middleware",
  "Port library X to Cloudflare Workers",
  "Ship a webhook signature helper",
];
const bountySolvedSeeds = [
  "Realtime notification fan-out on Workers",
  "Zero-downtime pg_dump replacement",
  "S3-compatible image proxy",
  "Cross-region session sync",
  "Bulk import parser with 3x throughput",
];

function expand<T>(base: T[], target: number, make: (i: number) => T): T[] {
  if (base.length >= target) return base;
  const out = [...base];
  for (let i = base.length; i < target; i++) out.push(make(i));
  return out;
}

function daysAgo(n: number): string {
  if (n === 0) return "just now";
  if (n < 24) return `${n}h ago`;
  const d = Math.floor(n / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

function buildFullProfile(id: string): {
  posts: ProfilePost[];
  groups: ProfileGroup[];
  listings: ProfileListing[];
  bountiesPosted: ProfileBounty[];
  bountiesSolved: ProfileBounty[];
} {
  const profile: Profile = getProfile(id);
  const seed = hash(id);
  const rnd = (offset: number, mod: number) => (hash(`${id}:${offset}`) + seed) % mod;

  // Deterministic totals per profile+tab (varied but stable)
  const postsTotal = (profile.posts.length || 1) + (rnd(1, 18) + 4);
  const groupsTotal = (profile.groups.length || 1) + (rnd(2, 8) + 2);
  const listingsTotal = (profile.listings.length || 0) + (rnd(3, 12) + 1);
  const postedTotal = profile.bountiesPosted.length + (rnd(4, 6));
  const solvedTotal = profile.bountiesSolved.length + (rnd(5, 8));

  const posts = expand(profile.posts, postsTotal, (i) => ({
    id: `p-gen-${i}`,
    content: postSeeds[(i + rnd(10, postSeeds.length)) % postSeeds.length],
    timeAgo: daysAgo((i + 1) * 6 + (rnd(11, 5))),
    likes: 8 + ((rnd(12, 400) + i * 7) % 500),
    comments: (rnd(13, 60) + i) % 90,
  }));

  const groups = expand(profile.groups, groupsTotal, (i) => ({
    id: `g-gen-${i}`,
    name: groupNames[(i + rnd(20, groupNames.length)) % groupNames.length],
    members: 500 + ((rnd(21, 20000) + i * 137) % 25000),
    tag: groupTags[(i + rnd(22, groupTags.length)) % groupTags.length],
  }));

  const listings = expand(profile.listings, listingsTotal, (i) => ({
    id: `l-gen-${i}`,
    title: listingSeeds[(i + rnd(30, listingSeeds.length)) % listingSeeds.length],
    category: categories[(i + rnd(31, categories.length)) % categories.length],
    priceUsd: 9 + ((rnd(32, 190) + i * 11) % 200),
    sales: 3 + ((rnd(33, 400) + i * 17) % 800),
  }));

  const bountiesPosted = expand(profile.bountiesPosted, postedTotal, (i) => ({
    id: `bp-gen-${i}`,
    title: bountyOpenSeeds[(i + rnd(40, bountyOpenSeeds.length)) % bountyOpenSeeds.length],
    amountUsd: 150 + ((rnd(41, 1500) + i * 53) % 1800),
    applicants: (rnd(42, 20) + i) % 30,
    status: "open" as const,
  }));

  const bountiesSolved = expand(profile.bountiesSolved, solvedTotal, (i) => ({
    id: `bs-gen-${i}`,
    title: bountySolvedSeeds[(i + rnd(50, bountySolvedSeeds.length)) % bountySolvedSeeds.length],
    amountUsd: 300 + ((rnd(51, 2000) + i * 71) % 2200),
    proof: "Deployment green across regions; benchmarks attached.",
    status: "solved" as const,
  }));

  return { posts, groups, listings, bountiesPosted, bountiesSolved };
}

export type ProfileTab = "posts" | "groups" | "marketplace" | "posted" | "solved";

export function loadProfileTab(profileId: string, tab: ProfileTab, page: number, pageSize: number) {
  const full = buildFullProfile(profileId);
  const all =
    tab === "posts"
      ? full.posts
      : tab === "groups"
        ? full.groups
        : tab === "marketplace"
          ? full.listings
          : tab === "posted"
            ? full.bountiesPosted
            : full.bountiesSolved;
  const total = all.length;
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { items, total, page: safePage, pageSize, hasMore: start + items.length < total };
}

export type ProfileItemKind =
  | "post"
  | "group"
  | "listing"
  | "bounty"
  | "solved";

export function loadProfileItem(profileId: string, kind: ProfileItemKind, itemId: string) {
  const full = buildFullProfile(profileId);
  const list =
    kind === "post"
      ? full.posts
      : kind === "group"
        ? full.groups
        : kind === "listing"
          ? full.listings
          : kind === "bounty"
            ? full.bountiesPosted
            : full.bountiesSolved;
  const item = list.find((x) => x.id === itemId);
  return item ?? null;
}

