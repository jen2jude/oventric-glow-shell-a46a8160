export interface ProfilePost {
  id: string;
  content: string;
  timeAgo: string;
  likes: number;
  comments: number;
}
export interface ProfileGroup {
  id: string;
  name: string;
  members: number;
  tag: string;
}
export interface ProfileListing {
  id: string;
  title: string;
  category: string;
  priceUsd: number;
  sales: number;
}
export interface ProfileBounty {
  id: string;
  title: string;
  amountUsd: number;
  applicants?: number;
  proof?: string;
  status: "open" | "solved";
}
export interface Profile {
  id: string;
  name: string;
  initials: string;
  role: string;
  bio: string;
  avatarGradient: string;
  joined: string;
  followers: number;
  reputation: {
    bountiesSolved: number;
    coursesCompleted: number;
    salesCount: number;
    disputeRate: number; // percent (lower is better)
    retentionRate: number; // percent of buyers/students who stay active (higher is better)
    refundRate: number; // percent of orders refunded (lower is better)
    activityScore: number; // 0-100, platform usage frequency (days active in last 30)
  };
  posts: ProfilePost[];
  groups: ProfileGroup[];
  listings: ProfileListing[];
  bountiesPosted: ProfileBounty[];
  bountiesSolved: ProfileBounty[];
  dm: { from: "them" | "me"; text: string; time: string }[];
}

const base: Record<string, Profile> = {
  "aria-kessler": {
    id: "aria-kessler",
    name: "Aria Kessler",
    initials: "AK",
    role: "Staff Engineer · Kessler Labs",
    bio: "Postgres-obsessed backend engineer. I ship RLS-first multi-tenant systems and mentor devs on scaling data layers.",
    avatarGradient: "from-purple-500 to-pink-500",
    joined: "March 2023",
    followers: 4820,
    reputation: {
      stars: 4.8,
      bountiesSolved: 27,
      coursesCompleted: 12,
      salesCount: 341,
      disputeRate: 0.4,
    },
    posts: [
      {
        id: "p1",
        content:
          "Just shipped a zero-downtime migration on our multi-tenant Postgres cluster. RLS + logical replication saved us weeks.",
        timeAgo: "2h ago",
        likes: 128,
        comments: 24,
      },
      {
        id: "p2",
        content: "Hot take: most 'realtime' features are just polling with extra steps. Fight me in the comments.",
        timeAgo: "1d ago",
        likes: 412,
        comments: 89,
      },
      {
        id: "p3",
        content: "Dropped v2 of my Postgres RLS Starter Kit — now with typed policy helpers and audit log middleware.",
        timeAgo: "3d ago",
        likes: 256,
        comments: 41,
      },
    ],
    groups: [
      { id: "g1", name: "Postgres Power Users", members: 12400, tag: "Database" },
      { id: "g2", name: "SaaS Architects Circle", members: 8200, tag: "Architecture" },
      { id: "g3", name: "Edge Runtime Builders", members: 5100, tag: "Infra" },
      { id: "g4", name: "Women in Backend", members: 9700, tag: "Community" },
    ],
    listings: [
      { id: "l1", title: "Postgres RLS Starter Kit", category: "Scripts", priceUsd: 49, sales: 341 },
      { id: "l2", title: "Supabase Audit Log Middleware", category: "Plugins", priceUsd: 29, sales: 128 },
      { id: "l3", title: "Multi-tenant Schema Blueprint", category: "HTML Blocks", priceUsd: 79, sales: 62 },
    ],
    bountiesPosted: [
      { id: "b1", title: "Convert Prisma schema to Drizzle w/ RLS policies", amountUsd: 450, applicants: 12, status: "open" },
      { id: "b2", title: "Write a pgvector migration tool", amountUsd: 900, applicants: 6, status: "open" },
    ],
    bountiesSolved: [
      {
        id: "s1",
        title: "Realtime notification fan-out on Cloudflare Workers",
        amountUsd: 1200,
        proof: "PR merged, 99.98% delivery, <40ms p95 across 12 regions.",
        status: "solved",
      },
      {
        id: "s2",
        title: "Zero-downtime pg_dump replacement",
        amountUsd: 800,
        proof: "Open-sourced tool, benchmarked 3x faster on 400GB dataset.",
        status: "solved",
      },
    ],
    dm: [
      { from: "them", text: "Hey! Loved your RLS post — do you consult?", time: "10:14" },
      { from: "me", text: "Thanks! Occasionally — DM me your scope.", time: "10:22" },
      { from: "them", text: "Cool, sending a brief later today.", time: "10:23" },
    ],
  },
};

export function getProfile(id: string): Profile {
  if (base[id]) return base[id];
  // fallback generated profile so any id routes cleanly
  const pretty = id
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  const initials = pretty
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return {
    id,
    name: pretty || "Anonymous Builder",
    initials: initials || "??",
    role: "Independent Builder",
    bio: "Building in public on Oventric.",
    avatarGradient: "from-emerald-400 to-emerald-600",
    joined: "2024",
    followers: 128,
    reputation: {
      stars: 4.2,
      bountiesSolved: 3,
      coursesCompleted: 2,
      salesCount: 14,
      disputeRate: 1.1,
    },
    posts: [
      { id: "p1", content: "New here — shipping small things every day.", timeAgo: "5h ago", likes: 12, comments: 3 },
    ],
    groups: [{ id: "g1", name: "Indie Hackers", members: 2100, tag: "Community" }],
    listings: [{ id: "l1", title: "Starter Template", category: "Themes", priceUsd: 19, sales: 4 }],
    bountiesPosted: [],
    bountiesSolved: [],
    dm: [{ from: "them", text: "Hey, thanks for connecting!", time: "09:00" }],
  };
}
