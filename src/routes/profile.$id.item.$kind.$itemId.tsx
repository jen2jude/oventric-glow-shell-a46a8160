import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { ArrowLeft, Users, Award, Target, ShoppingBag, ExternalLink, MessageCircle } from "lucide-react";
import { Header } from "@/components/oventric/Header";
import { MobileNav } from "@/components/oventric/MobileNav";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getProfile } from "@/lib/profiles/mockProfiles";
import { getProfileItem, type ProfileItemKind } from "@/lib/profiles.functions";
import type {
  ProfilePost,
  ProfileGroup,
  ProfileListing,
  ProfileBounty,
} from "@/lib/profiles/mockProfiles";

const VALID_KINDS: ProfileItemKind[] = ["post", "group", "listing", "bounty", "solved"];

function labelFor(kind: ProfileItemKind): string {
  switch (kind) {
    case "post":
      return "Post";
    case "group":
      return "Group";
    case "listing":
      return "Marketplace item";
    case "bounty":
      return "Bounty";
    case "solved":
      return "Solved bounty";
  }
}

export const Route = createFileRoute("/profile/$id/item/$kind/$itemId")({
  loader: async ({ params }) => {
    if (!VALID_KINDS.includes(params.kind as ProfileItemKind)) throw notFound();
    const { item } = await getProfileItem({
      data: {
        profileId: params.id,
        kind: params.kind as ProfileItemKind,
        itemId: params.itemId,
      },
    });
    if (!item) throw notFound();
    return { item, kind: params.kind as ProfileItemKind };
  },
  head: ({ params, loaderData }) => {
    const label = VALID_KINDS.includes(params.kind as ProfileItemKind)
      ? labelFor(params.kind as ProfileItemKind)
      : "Item";
    const title = loaderData
      ? "content" in loaderData.item
        ? `Post by @${params.id}`
        : "title" in loaderData.item
          ? `${loaderData.item.title} — @${params.id}`
          : "name" in loaderData.item
            ? `${loaderData.item.name} — @${params.id}`
            : `${label} — @${params.id}`
      : `${label} — @${params.id}`;
    return {
      meta: [
        { title },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: ({ error, reset }) => (
    <Shell>
      <div className="bg-[#1E1E24] border border-red-500/30 rounded-xl p-6 text-center">
        <div className="text-sm text-red-300 mb-3">{error.message}</div>
        <button onClick={reset} className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5 text-xs">
          Try again
        </button>
      </div>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <div className="bg-[#1E1E24] border border-white/10 rounded-xl p-8 text-center text-sm text-slate-400">
        This item is no longer available.
      </div>
    </Shell>
  ),
  component: ItemDetail,
});

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="relative h-screen overflow-hidden bg-[#121214] text-slate-200">
      <div className="pointer-events-none fixed top-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-[2px] z-50 rgb-neon-bg" />
      <div className="flex h-full flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="max-w-3xl mx-auto w-full px-4 py-6">{children}</div>
        </main>
        <MobileNav onCreate={() => {}} active="Feed" onSelect={() => navigate({ to: "/" })} />
      </div>
    </div>
  );
}

function ItemDetail() {
  const { id, kind } = Route.useParams();
  const { item } = Route.useLoaderData();
  const profile = getProfile(id);
  const { baseCurrency, require } = useOnboarding();

  const fx = baseCurrency === "USD" ? 1 : baseCurrency === "NGN" ? 1500 : 14;
  const sym = baseCurrency === "USD" ? "$" : baseCurrency === "NGN" ? "₦" : "₵";
  const price = (usd: number) => `${sym}${(usd * fx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <Shell>
      <Link
        to="/profile/$id"
        params={{ id }}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to @{profile.name}
      </Link>

      {/* Author strip */}
      <Link
        to="/profile/$id"
        params={{ id }}
        className="flex items-center gap-3 mb-4 group"
      >
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${profile.avatarGradient} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
          {profile.initials}
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate group-hover:text-emerald-300">{profile.name}</div>
          <div className="text-[11px] text-slate-500 truncate">{profile.role}</div>
        </div>
      </Link>

      <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-2">
        {labelFor(kind as ProfileItemKind)}
      </div>

      {kind === "post" && <PostView post={item as ProfilePost} authorName={profile.name} />}
      {kind === "group" && <GroupView group={item as ProfileGroup} />}
      {kind === "listing" && (
        <ListingView
          listing={item as ProfileListing}
          price={price}
          onBuy={() => require(2, () => alert("Proceed to checkout (mock)"))}
        />
      )}
      {kind === "bounty" && <BountyView bounty={item as ProfileBounty} price={price} />}
      {kind === "solved" && <SolvedView bounty={item as ProfileBounty} price={price} />}
    </Shell>
  );
}

function PostView({ post, authorName }: { post: ProfilePost; authorName: string }) {
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="text-xs text-slate-500 mb-3">
        {authorName} · {post.timeAgo}
      </div>
      <p className="text-base text-slate-100 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-5 text-sm text-slate-400">
        <span>❤ {post.likes} likes</span>
        <span>💬 {post.comments} comments</span>
      </div>
    </article>
  );
}

function GroupView({ group }: { group: ProfileGroup }) {
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-black">
          <Users className="w-7 h-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-white text-xl font-black">{group.name}</h1>
          <div className="text-xs text-slate-500 mt-0.5">
            {group.tag} · {group.members.toLocaleString()} members
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">
        A working community of practitioners shipping in the {group.tag.toLowerCase()} space.
        Weekly threads, live jams, and open bounties.
      </p>
      <div className="mt-5 flex gap-2">
        <button className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold">
          Join group
        </button>
        <button className="px-4 py-2 rounded-lg border border-white/15 text-white hover:bg-white/5 text-sm font-semibold inline-flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Message admins
        </button>
      </div>
    </article>
  );
}

function ListingView({ listing, price, onBuy }: { listing: ProfileListing; price: (u: number) => string; onBuy: () => void }) {
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">{listing.category}</div>
      <h1 className="text-white text-2xl font-black mt-1">{listing.title}</h1>
      <div className="mt-4 flex items-end gap-4">
        <div className="text-white font-black text-3xl">{price(listing.priceUsd)}</div>
        <div className="text-xs text-slate-500 mb-1 inline-flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5" /> {listing.sales} sold
        </div>
      </div>
      <p className="text-sm text-slate-300 mt-5 leading-relaxed">
        Production-tested asset from this creator's marketplace catalog. Includes source files,
        setup guide, and 30 days of update access.
      </p>
      <button
        onClick={onBuy}
        className="mt-6 w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
      >
        Buy Now — {price(listing.priceUsd)}
      </button>
    </article>
  );
}

function BountyView({ bounty, price }: { bounty: ProfileBounty; price: (u: number) => string }) {
  return (
    <article className="bg-[#1E1E24] border border-emerald-500/40 rounded-xl p-6">
      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-300 mb-2">
        <Target className="w-3.5 h-3.5" /> [ACTIVE · {price(bounty.amountUsd)}]
      </div>
      <h1 className="text-white text-2xl font-black leading-tight">{bounty.title}</h1>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-black/30 border border-white/5 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Escrow</div>
          <div className="text-white font-black text-lg mt-1">{price(bounty.amountUsd)}</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Applicants</div>
          <div className="text-white font-black text-lg mt-1">{bounty.applicants ?? 0}</div>
        </div>
      </div>
      <p className="text-sm text-slate-300 mt-5 leading-relaxed">
        Open bounty. Escrow is funded and released on approved delivery. Post-submission review
        window is 72 hours.
      </p>
      <button className="mt-6 w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm">
        Apply to solve
      </button>
    </article>
  );
}

function SolvedView({ bounty, price }: { bounty: ProfileBounty; price: (u: number) => string }) {
  return (
    <article className="bg-[#1E1E24] border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-2 text-[11px] font-bold text-purple-300 mb-2">
        <Award className="w-3.5 h-3.5" /> [SOLVED · {price(bounty.amountUsd)}]
      </div>
      <h1 className="text-white text-2xl font-black leading-tight">{bounty.title}</h1>
      {bounty.proof && (
        <div className="mt-5 bg-black/30 border border-white/5 rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Technical execution proof
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{bounty.proof}</p>
          <button className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
            View artifact <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="mt-5 text-xs text-slate-500">
        Payout released and dispute window cleared.
      </div>
    </article>
  );
}
