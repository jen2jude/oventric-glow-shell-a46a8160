export type ThreadFilter = "all" | "circle" | "bounty";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text?: string;
  code?: { language: string; body: string };
  attachments?: { name: string; kind: "image" | "file"; hint?: string }[];
  time: string;
}

export interface ChatThread {
  id: string;
  peerId: string;
  peerName: string;
  peerInitials: string;
  peerGradient: string;
  peerRole: string;
  peerRating: number;
  online: boolean;
  lastActive: string; // e.g. "2m ago"
  preview: string;
  unread: boolean;
  inCircle: boolean;
  bounty?: {
    id: string;
    title: string;
    escrowUsd: number;
  };
  messages: ChatMessage[];
}

export const mockThreads: ChatThread[] = [
  {
    id: "t-aria",
    peerId: "aria-kessler",
    peerName: "Aria Kessler",
    peerInitials: "AK",
    peerGradient: "from-purple-500 to-pink-500",
    peerRole: "Staff Engineer",
    peerRating: 4.9,
    online: true,
    lastActive: "2m ago",
    preview: "Sent you the RLS scaffolding — check the audit middleware…",
    unread: true,
    inCircle: true,
    bounty: {
      id: "b-rls",
      title: "Convert Prisma schema to Drizzle w/ RLS policies",
      escrowUsd: 450,
    },
    messages: [
      { id: "m1", from: "them", text: "Hey! Ready to kick this bounty off?", time: "10:14" },
      { id: "m2", from: "me", text: "Yes — pulled your starter. Have a question on the tenant_id column.", time: "10:16" },
      {
        id: "m3",
        from: "them",
        code: {
          language: "sql",
          body: "CREATE POLICY tenant_isolation ON public.orders\n  USING (tenant_id = current_setting('app.tenant_id')::uuid);",
        },
        time: "10:18",
      },
      { id: "m4", from: "me", text: "Perfect. Deploying to staging now.", time: "10:19" },
      { id: "m5", from: "them", text: "Sent you the RLS scaffolding — check the audit middleware.", time: "10:22" },
    ],
  },
  {
    id: "t-mira",
    peerId: "mira-okonkwo",
    peerName: "Mira Okonkwo",
    peerInitials: "MO",
    peerGradient: "from-emerald-400 to-teal-500",
    peerRole: "Realtime Engineer",
    peerRating: 4.7,
    online: true,
    lastActive: "12m ago",
    preview: "Can you review my WebRTC fan-out draft before I ship?",
    unread: true,
    inCircle: true,
    messages: [
      { id: "m1", from: "them", text: "Hi! Quick review request when you have a sec.", time: "09:48" },
      { id: "m2", from: "them", text: "Can you review my WebRTC fan-out draft before I ship?", time: "09:50" },
    ],
  },
  {
    id: "t-jules",
    peerId: "jules-tan",
    peerName: "Jules Tan",
    peerInitials: "JT",
    peerGradient: "from-sky-400 to-indigo-500",
    peerRole: "Solo dev",
    peerRating: 4.5,
    online: false,
    lastActive: "1h ago",
    preview: "Payout received — thanks for the fast turnaround 🙏",
    unread: false,
    inCircle: false,
    bounty: {
      id: "b-webhook",
      title: "Stripe webhook idempotency harness",
      escrowUsd: 220,
    },
    messages: [
      { id: "m1", from: "me", text: "Escrow released. Nice work!", time: "Yesterday" },
      { id: "m2", from: "them", text: "Payout received — thanks for the fast turnaround 🙏", time: "Yesterday" },
    ],
  },
  {
    id: "t-devon",
    peerId: "devon-ray",
    peerName: "Devon Ray",
    peerInitials: "DR",
    peerGradient: "from-amber-400 to-orange-500",
    peerRole: "DevRel",
    peerRating: 4.2,
    online: false,
    lastActive: "3h ago",
    preview: "Hey, wanted to chat about the upcoming Academy launch cohort.",
    unread: false,
    inCircle: false,
    messages: [
      { id: "m1", from: "them", text: "Hey, wanted to chat about the upcoming Academy launch cohort.", time: "07:02" },
    ],
  },
  {
    id: "t-sana",
    peerId: "sana-iqbal",
    peerName: "Sana Iqbal",
    peerInitials: "SI",
    peerGradient: "from-fuchsia-500 to-pink-500",
    peerRole: "AI Engineer",
    peerRating: 4.8,
    online: true,
    lastActive: "yesterday",
    preview: "Dropped my embeddings pipeline — feedback welcome.",
    unread: false,
    inCircle: true,
    messages: [
      { id: "m1", from: "them", text: "Dropped my embeddings pipeline — feedback welcome.", time: "Yesterday" },
    ],
  },
];

export function filterThreads(threads: ChatThread[], filter: ThreadFilter, query: string) {
  const q = query.trim().toLowerCase();
  return threads.filter((t) => {
    if (filter === "circle" && !t.inCircle) return false;
    if (filter === "bounty" && !t.bounty) return false;
    if (!q) return true;
    return (
      t.peerName.toLowerCase().includes(q) ||
      t.preview.toLowerCase().includes(q) ||
      (t.bounty?.title.toLowerCase().includes(q) ?? false)
    );
  });
}
