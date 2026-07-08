export type CircleCategory =
  | "AI Engineering"
  | "Design Systems"
  | "Web3/Crypto"
  | "Mobile Apps"
  | "SaaS Builders";

export interface CirclePost {
  id: string;
  author: string;
  initials: string;
  hue: string;
  time: string;
  text: string;
  likes: number;
  comments: number;
}

export interface CircleBounty {
  id: string;
  title: string;
  budgetUSD: number;
  tag: string;
  applicants: number;
  closesInDays: number;
}

export interface CircleAsset {
  id: string;
  name: string;
  vendor: string;
  priceUSD: number;
  kind: "Repo" | "Bundle" | "Snippet" | "Theme";
  hue: string;
}

export interface Circle {
  id: string;
  name: string;
  category: CircleCategory;
  bio: string;
  peers: number;
  totalEarningsUSD: number;
  emoji: string;
  bannerHue: string;
  avatarHue: string;
  trending?: boolean;
  private?: boolean;
  posts: CirclePost[];
  bounties: CircleBounty[];
  assets: CircleAsset[];
}

export const CIRCLE_CATEGORIES: Array<"All Guilds" | CircleCategory> = [
  "All Guilds",
  "Design Systems",
  "Web3/Crypto",
  "Mobile Apps",
  "SaaS Builders",
  "AI Engineering",
];

const posts = (seed: string): CirclePost[] => [
  {
    id: `${seed}-p1`,
    author: "Ada Kessler",
    initials: "AK",
    hue: "from-emerald-500 to-teal-600",
    time: "2h",
    text: "Just shipped a streaming server-fn helper — 40% latency drop on edge. Anyone want to code review?",
    likes: 42,
    comments: 8,
  },
  {
    id: `${seed}-p2`,
    author: "Rin Osei",
    initials: "RO",
    hue: "from-fuchsia-500 to-purple-700",
    time: "5h",
    text: "Question: best pattern for optimistic UI in TanStack Query when the mutation is a webhook trigger?",
    likes: 17,
    comments: 12,
  },
  {
    id: `${seed}-p3`,
    author: "Milo Zhang",
    initials: "MZ",
    hue: "from-amber-500 to-orange-600",
    time: "1d",
    text: "Open-sourced our RLS starter kit. Grants, has_role, JWT claims — the whole thing.",
    likes: 88,
    comments: 21,
  },
  {
    id: `${seed}-p4`,
    author: "Priya Anand",
    initials: "PA",
    hue: "from-sky-500 to-cyan-600",
    time: "1d",
    text: "Hiring: need a senior frontend for a 3-week contract, react/tanstack heavy. DM if interested.",
    likes: 24,
    comments: 5,
  },
  {
    id: `${seed}-p5`,
    author: "Kai Fenwick",
    initials: "KF",
    hue: "from-rose-500 to-red-600",
    time: "2d",
    text: "Weekly demo Friday — bring what you're building. Focused feedback, 5 min each.",
    likes: 31,
    comments: 9,
  },
];

const bounties = (cat: CircleCategory): CircleBounty[] => [
  { id: "b1", title: `${cat} · Design a token-gated onboarding flow`, budgetUSD: 1200, tag: cat, applicants: 7, closesInDays: 5 },
  { id: "b2", title: `${cat} · Migrate legacy REST to typed RPCs`, budgetUSD: 3400, tag: cat, applicants: 12, closesInDays: 9 },
  { id: "b3", title: `${cat} · Realtime presence & typing indicators`, budgetUSD: 800, tag: cat, applicants: 4, closesInDays: 3 },
  { id: "b4", title: `${cat} · Multi-tenant billing dashboard`, budgetUSD: 5200, tag: cat, applicants: 18, closesInDays: 14 },
];

const assets = (): CircleAsset[] => [
  { id: "a1", name: "Nebula Component Library", vendor: "Kessler Labs", priceUSD: 49, kind: "Bundle", hue: "from-indigo-500 to-purple-700" },
  { id: "a2", name: "Postgres RLS Starter", vendor: "Kessler Labs", priceUSD: 39, kind: "Repo", hue: "from-emerald-500 to-teal-700" },
  { id: "a3", name: "Webhook Signer Snippet", vendor: "Vaultly", priceUSD: 11, kind: "Snippet", hue: "from-amber-500 to-orange-700" },
  { id: "a4", name: "Aurora SaaS Theme", vendor: "PixelForge", priceUSD: 79, kind: "Theme", hue: "from-fuchsia-500 to-pink-700" },
  { id: "a5", name: "Realtime Chat Kit", vendor: "SocketLab", priceUSD: 24, kind: "Bundle", hue: "from-sky-500 to-blue-700" },
  { id: "a6", name: "Edge Cache Booster", vendor: "Turbomesh", priceUSD: 18, kind: "Snippet", hue: "from-cyan-500 to-teal-700" },
];

export const MOCK_CIRCLES: Circle[] = [
  {
    id: "c1",
    name: "TransformerOps",
    category: "AI Engineering",
    bio: "LLM infra, evals, and edge inference. Peer review welcome.",
    peers: 1240,
    totalEarningsUSD: 84200,
    emoji: "🧠",
    bannerHue: "from-fuchsia-600 via-purple-700 to-indigo-800",
    avatarHue: "from-fuchsia-500 to-purple-700",
    trending: true,
    posts: posts("c1"),
    bounties: bounties("AI Engineering"),
    assets: assets(),
  },
  {
    id: "c2",
    name: "Pixel Architects",
    category: "Design Systems",
    bio: "Tokens, primitives, and accessible components at scale.",
    peers: 890,
    totalEarningsUSD: 47600,
    emoji: "🎨",
    bannerHue: "from-emerald-500 via-teal-600 to-cyan-700",
    avatarHue: "from-emerald-500 to-teal-700",
    trending: true,
    posts: posts("c2"),
    bounties: bounties("Design Systems"),
    assets: assets(),
  },
  {
    id: "c3",
    name: "Chain Forge",
    category: "Web3/Crypto",
    bio: "Smart-contract audits, L2 tooling, wallet UX.",
    peers: 2100,
    totalEarningsUSD: 132500,
    emoji: "⛓️",
    bannerHue: "from-amber-500 via-orange-600 to-rose-700",
    avatarHue: "from-amber-500 to-orange-700",
    trending: true,
    posts: posts("c3"),
    bounties: bounties("Web3/Crypto"),
    assets: assets(),
  },
  {
    id: "c4",
    name: "Pocket Rockets",
    category: "Mobile Apps",
    bio: "React Native, Expo, native modules. Ship weekly.",
    peers: 640,
    totalEarningsUSD: 28900,
    emoji: "📱",
    bannerHue: "from-sky-500 via-blue-600 to-indigo-700",
    avatarHue: "from-sky-500 to-blue-700",
    posts: posts("c4"),
    bounties: bounties("Mobile Apps"),
    assets: assets(),
  },
  {
    id: "c5",
    name: "SaaS Syndicate",
    category: "SaaS Builders",
    bio: "Bootstrapped founders. Pricing, churn, growth loops.",
    peers: 1520,
    totalEarningsUSD: 96400,
    emoji: "🚀",
    bannerHue: "from-rose-500 via-pink-600 to-fuchsia-700",
    avatarHue: "from-rose-500 to-pink-700",
    trending: true,
    posts: posts("c5"),
    bounties: bounties("SaaS Builders"),
    assets: assets(),
  },
  {
    id: "c6",
    name: "Prompt Alchemists",
    category: "AI Engineering",
    bio: "Prompt engineering, agents, and retrieval pipelines.",
    peers: 780,
    totalEarningsUSD: 33100,
    emoji: "✨",
    bannerHue: "from-violet-500 via-purple-700 to-indigo-800",
    avatarHue: "from-violet-500 to-purple-700",
    posts: posts("c6"),
    bounties: bounties("AI Engineering"),
    assets: assets(),
  },
  {
    id: "c7",
    name: "Type Safe Union",
    category: "SaaS Builders",
    bio: "TypeScript zealots. DX, codegen, monorepos.",
    peers: 410,
    totalEarningsUSD: 18700,
    emoji: "🧩",
    bannerHue: "from-cyan-500 via-sky-600 to-blue-800",
    avatarHue: "from-cyan-500 to-blue-700",
    private: true,
    posts: posts("c7"),
    bounties: bounties("SaaS Builders"),
    assets: assets(),
  },
];
