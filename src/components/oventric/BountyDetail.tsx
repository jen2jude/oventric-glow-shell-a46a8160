import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Target,
  Clock,
  Users,
  MessageCircle,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Loader2,
  Send,
  Star,
  ShieldCheck,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, type Currency } from "@/lib/onboarding/OnboardingContext";
import { computeDisplayPrice } from "@/lib/fx-display";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { BountySolveForm } from "@/components/oventric/BountySolveForm";
import { BountyTimeline } from "@/components/oventric/bounty/BountyTimeline";
import {
  ProposalSortDropdown,
  sortProposals,
  type ProposalSortKey,
} from "@/components/oventric/bounty/ProposalSort";
import {
  applyToBounty,
  acceptApplicant,
  markBountySolved,
  confirmAndRelease,
  openBountyDispute,
} from "@/lib/bounties.functions";

interface Props {
  bountyId: string;
  onBack: () => void;
}

interface BountyRow {
  id: string;
  title: string;
  description: string;
  category: string;
  price_usd: number;
  original_currency: string | null;
  original_amount: number | null;
  fx_snapshot: unknown;
  cover_path: string | null;
  images: string[];
  deadline_at: string | null;
  end_at: string | null;
  solved_at: string | null;
  released_at: string | null;
  status: string;
  dispute_status: string;
  admin_hold: boolean;
  poster_id: string;
  accepted_applicant_id: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  slug: string | null;
  avatar_path: string | null;
}

interface AppRow {
  id: string;
  bounty_id: string;
  applicant_id: string;
  pitch: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function timeLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("bounty-covers").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function BountyDetail({ bountyId, onBack }: Props) {
  const { require, baseCurrency } = useOnboarding();
  const [me, setMe] = useState<string | null>(null);
  const [bounty, setBounty] = useState<BountyRow | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [apps, setApps] = useState<AppRow[]>([]);
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSolved, setConfirmSolved] = useState(false);
  const [awaitingPop, setAwaitingPop] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [appSort, setAppSort] = useState<ProposalSortKey>("newest");

  const applyFn = useServerFn(applyToBounty);
  const acceptFn = useServerFn(acceptApplicant);
  const solvedFn = useServerFn(markBountySolved);
  const releaseFn = useServerFn(confirmAndRelease);
  const disputeFn = useServerFn(openBountyDispute);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: b, error: bErr } = await supabase
      .from("bounties")
      .select(
        "id, title, description, category, price_usd, original_currency, original_amount, fx_snapshot, cover_path, images, deadline_at, end_at, solved_at, released_at, status, dispute_status, admin_hold, poster_id, accepted_applicant_id, created_at",
      )
      .eq("id", bountyId)
      .maybeSingle();
    if (bErr || !b) {
      setError(bErr?.message ?? "Bounty not found");
      setLoading(false);
      return;
    }
    setBounty(b as BountyRow);

    // Applications — RLS lets any signed-in user read, so this only returns
    // rows for signed-in viewers.
    const { data: a } = await supabase
      .from("bounty_applications")
      .select("id, bounty_id, applicant_id, pitch, status, created_at, updated_at")
      .eq("bounty_id", bountyId)
      .order("created_at", { ascending: false });
    setApps((a ?? []) as AppRow[]);

    const ids = Array.from(
      new Set(
        [b.poster_id, b.accepted_applicant_id, ...(a ?? []).map((x) => x.applicant_id)].filter(
          Boolean,
        ) as string[],
      ),
    );
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, slug, avatar_path")
        .in("user_id", ids);
      const map: Record<string, ProfileRow> = {};
      for (const row of (p ?? []) as ProfileRow[]) map[row.user_id] = row;
      setProfiles(map);
    }

    // Sign image URLs
    const paths = [b.cover_path, ...(b.images ?? [])].filter(Boolean) as string[];
    const uniq = Array.from(new Set(paths));
    const signed = await Promise.all(uniq.map(signedUrl));
    setImgUrls(signed.filter((u): u is string => !!u));

    setLoading(false);
  }, [bountyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh on any change to this bounty or its apps
  useEffect(() => {
    const ch = supabase
      .channel(`bounty-detail:${bountyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bounties", filter: `id=eq.${bountyId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bounty_applications",
          filter: `bounty_id=eq.${bountyId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [bountyId, load]);

  const myApp = useMemo(
    () => (me ? (apps.find((a) => a.applicant_id === me) ?? null) : null),
    [apps, me],
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }
  if (error || !bounty) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 p-4 text-sm">
          {error ?? "Bounty not found"}
        </div>
      </div>
    );
  }

  const isPoster = me === bounty.poster_id;
  const isSolver = me === bounty.accepted_applicant_id;
  const acceptedProfile = bounty.accepted_applicant_id
    ? profiles[bounty.accepted_applicant_id]
    : null;
  const posterProfile = profiles[bounty.poster_id];
  const dp = computeDisplayPrice(
    {
      price_usd: Number(bounty.price_usd),
      original_currency: bounty.original_currency,
      original_amount: bounty.original_amount,
      fx_snapshot: bounty.fx_snapshot,
    },
    baseCurrency,
  );

  const openDM = (peerId: string | null | undefined) => {
    if (!peerId) return;
    window.dispatchEvent(new CustomEvent("oventric:open-dm", { detail: { peerId } }));
  };

  const doApply = async () => {
    if (!pitch.trim()) return;
    require(2, async () => {
      setBusy("apply");
      try {
        await applyFn({ data: { bounty_id: bountyId, pitch: pitch.trim() } });
        setPitch("");
        await load();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(null);
      }
    }, "solver");
  };

  const doAccept = async (applicantId: string) => {
    setAcceptTarget(null);
    setBusy(`accept:${applicantId}`);

    try {
      await acceptFn({ data: { bounty_id: bountyId, applicant_id: applicantId } });
      await load();
      openDM(applicantId);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doMarkSolved = async () => {
    setConfirmSolved(false);
    setBusy("solved");
    try {
      await solvedFn({ data: { bounty_id: bountyId } });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doRelease = async () => {
    setConfirmRelease(false);
    setBusy("release");
    try {
      await releaseFn({ data: { bounty_id: bountyId } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doDispute = async () => {
    const reason = prompt("Describe the issue for admin review:");
    if (!reason || !reason.trim()) return;
    setBusy("dispute");
    try {
      await disputeFn({ data: { bounty_id: bountyId, reason: reason.trim() } });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const statusPill = (() => {
    if (bounty.released_at)
      return { label: "Released", cls: "bg-slate-500/15 border-slate-500/40 text-slate-300" };
    if (bounty.dispute_status === "open")
      return { label: "In dispute", cls: "bg-amber-500/15 border-amber-500/40 text-amber-300" };
    if (bounty.status === "solved")
      return {
        label: "Awaiting confirmation",
        cls: "bg-sky-500/15 border-sky-500/40 text-sky-300",
      };
    if (bounty.accepted_applicant_id)
      return {
        label: "In progress",
        cls: "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300",
      };
    return { label: "Open", cls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" };
  })();

  const remaining = timeLeft(bounty.deadline_at ?? bounty.end_at);
  const solvedAgeH = bounty.solved_at
    ? Math.max(0, (Date.now() - new Date(bounty.solved_at).getTime()) / 3_600_000)
    : 0;
  const autoReleaseIn =
    bounty.solved_at && bounty.status === "solved" ? Math.max(0, 48 - solvedAgeH) : null;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-6 md:text-slate-700">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-300 md:text-slate-600 hover:text-white md:hover:text-slate-900 bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-[10px] px-3 py-1.5 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bounty Board
      </button>

      {/* Header card */}
      <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl overflow-hidden mb-5">
        {imgUrls[0] && (
          <ResponsiveImage
            src={imgUrls[0]}
            alt={bounty.title}
            className="w-full max-h-72 object-cover"
            sizes="(min-width: 768px) 800px, 100vw"
            loading="eager"
          />
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 md:text-emerald-700 text-[10px] font-bold tracking-wider">
              <Target className="w-3 h-3" /> {dp.formatted}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] border text-[10px] font-bold tracking-wider ${statusPill.cls}`}
            >
              {statusPill.label}
            </span>
            {bounty.admin_hold && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] bg-red-500/15 border border-red-500/40 text-red-300 md:text-red-700 text-[10px] font-bold tracking-wider">
                <Lock className="w-3 h-3" /> Admin hold
              </span>
            )}
          </div>
          <h1 className="mt-2 text-white md:text-slate-900 text-xl md:text-2xl font-black leading-tight">
            {bounty.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:text-slate-500">
            {remaining && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> {remaining} left
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {apps.length}{" "}
              {apps.length === 1 ? "applicant" : "applicants"}
            </span>
            {autoReleaseIn !== null && (
              <span className="inline-flex items-center gap-1 text-sky-300">
                <ShieldCheck className="w-3.5 h-3.5" /> Auto-release in ~{Math.ceil(autoReleaseIn)}h
              </span>
            )}
          </div>

          {/* Poster */}
          <div className="mt-4 flex items-center gap-3 pt-4 border-t border-white/5 md:border-slate-200">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 md:border-slate-200 shrink-0">
              <AvatarImage
                src={posterProfile?.avatar_path ?? null}
                alt={posterProfile?.display_name ?? "Poster"}
                className="w-full h-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white md:text-slate-900 text-sm font-semibold truncate">
                {posterProfile?.display_name || posterProfile?.username || "Poster"}
              </div>
              <div className="text-xs text-slate-500 truncate">
                @{posterProfile?.username || posterProfile?.slug || "user"} · posted this bounty
              </div>
            </div>
            {me && !isPoster && (
              <button
                onClick={() => openDM(bounty.poster_id)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-xs font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Message
              </button>
            )}
          </div>

          {bounty.description && (
            <div className="mt-4 pt-4 border-t border-white/5 md:border-slate-200 text-sm text-slate-300 md:text-slate-700 whitespace-pre-wrap leading-relaxed">
              {bounty.description}
            </div>
          )}

          {imgUrls.length > 1 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {imgUrls.slice(1).map((u, i) => (
                <ResponsiveImage
                  key={i}
                  src={u}
                  alt={`${bounty.title} ${i + 2}`}
                  className="w-full h-32 object-cover rounded-[10px] border border-white/10 md:border-slate-200"
                  sizes="240px"
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BountyTimeline
        bounty={{
          created_at: bounty.created_at,
          accepted_applicant_id: bounty.accepted_applicant_id,
          accepted_at:
            apps.find(
              (a) => a.applicant_id === bounty.accepted_applicant_id && a.status === "accepted",
            )?.updated_at ?? null,
          solved_at: bounty.solved_at,
          released_at: bounty.released_at,
          dispute_status: bounty.dispute_status,
          status: bounty.status,
        }}
        applicationsCount={apps.length}
        firstApplicationAt={apps.length ? apps[apps.length - 1].created_at : null}
        acceptedProfile={acceptedProfile}
      />

      {/* Contract workspace: shown once a solver is accepted */}
      {bounty.accepted_applicant_id && (isPoster || isSolver) && (
        <div className="bg-[#1E1E24] md:bg-white border border-emerald-500/30 md:border-emerald-500/40 rounded-xl p-5 mb-5 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 md:text-emerald-700 text-[10px] font-bold tracking-wider mb-3">
            <Lock className="w-3 h-3" /> LIVE ESCROW CONTRACT · {dp.formatted}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 md:border-slate-200 shrink-0">
              <AvatarImage
                src={acceptedProfile?.avatar_path ?? null}
                alt={acceptedProfile?.display_name ?? "Solver"}
                className="w-full h-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white md:text-slate-900 text-sm font-semibold truncate">
                {isPoster ? "Solver: " : "Poster: "}
                {isPoster
                  ? acceptedProfile?.display_name || acceptedProfile?.username || "Solver"
                  : posterProfile?.display_name || posterProfile?.username || "Poster"}
              </div>
              <div className="text-xs text-slate-500">
                {isPoster ? "Working on your task" : "You accepted this bounty"}
              </div>
            </div>
            <button
              onClick={() => openDM(isPoster ? bounty.accepted_applicant_id : bounty.poster_id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
            >
              <MessageCircle className="w-4 h-4" /> Open Chat
            </button>
          </div>

          {bounty.dispute_status === "open" && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-amber-500/10 border border-amber-500/50 text-amber-200 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4" /> Dispute open — admin will review. Auto-release
              paused.
            </div>
          )}
          {bounty.admin_hold && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-red-500/10 border border-red-500/50 text-red-200 text-xs font-semibold">
              <Lock className="w-4 h-4" /> Funds on hold by admin.
            </div>
          )}

          {isSolver && bounty.status === "solved" && !bounty.released_at && (
            <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-[10px] bg-sky-500/10 border border-sky-500/40 text-sky-200 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Waiting for the poster to confirm the work was delivered okay. Your funds will be
                released to your wallet within 48 hours
                {autoReleaseIn !== null ? ` (~${Math.ceil(autoReleaseIn)}h remaining)` : ""}.
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isSolver && !bounty.released_at && bounty.status !== "solved" && (
              <button
                onClick={() =>
                  document
                    .getElementById("bounty-solve-form")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                disabled={bounty.dispute_status === "open"}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-sky-500 hover:bg-sky-400 text-black text-sm font-bold disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Submit your solution
              </button>
            )}
            {isSolver && bounty.status === "solved" && !bounty.released_at && (
              <button
                onClick={() => setAwaitingPop(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white/5 md:bg-sky-50 hover:bg-white/10 md:hover:bg-sky-100 border border-sky-500/40 text-sky-200 md:text-sky-700 text-sm font-bold"
              >
                <Clock className="w-4 h-4" /> Awaiting confirmation
              </button>
            )}
            {isPoster && !bounty.released_at && (
              <button
                onClick={() => setConfirmRelease(true)}
                disabled={
                  busy === "release" || bounty.dispute_status === "open" || bounty.admin_hold
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm &amp; release {dp.formatted}
              </button>
            )}
            {!bounty.released_at && bounty.dispute_status !== "open" && (
              <button
                onClick={doDispute}
                disabled={busy === "dispute"}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" /> Open dispute
              </button>
            )}
            {bounty.released_at && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Funds released — bounty complete
              </div>
            )}
          </div>
        </div>
      )}

      {/* Solve submission form / submitted solution */}
      {bounty.accepted_applicant_id && (isSolver || isPoster) && (
        <div id="bounty-solve-form">
          <BountySolveForm
            bountyId={bountyId}
            canSubmit={isSolver}
            delivered={bounty.status === "solved" || !!bounty.solved_at}
            onDelivered={doMarkSolved}
          />
        </div>
      )}

      {/* Apply form (non-poster, no accepted solver yet) */}
      {!isPoster && !bounty.accepted_applicant_id && !bounty.released_at && (
        <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl p-5 mb-5">
          <div className="text-white md:text-slate-900 font-bold text-sm mb-1 inline-flex items-center gap-2">
            <Star className="w-4 h-4 text-emerald-400" /> Apply for this bounty
          </div>
          <p className="text-xs text-slate-400 md:text-slate-500 mb-3">
            Tell the poster why you're the right solver. Your pitch will be sent as a direct message
            so they can chat with you immediately.
          </p>
          {myApp ? (
            <div className="rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 p-3 text-sm">
              {myApp.status === "accepted" ? (
                <>You've been accepted 🎉 — check the contract workspace above.</>
              ) : myApp.status === "rejected" ? (
                <>You weren't selected for this bounty.</>
              ) : (
                <>Your application is pending review. The poster has been notified.</>
              )}
              <div className="mt-2 text-xs text-slate-300 md:text-slate-600 whitespace-pre-wrap">
                {myApp.pitch}
              </div>
              <button
                onClick={() => openDM(bounty.poster_id)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-xs font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Message poster
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={pitch}
                onChange={(e) => setPitch(e.target.value.slice(0, 2000))}
                rows={5}
                placeholder="Your pitch — experience, timeline, approach…"
                className="w-full bg-[#121214] md:bg-white border border-white/10 md:border-slate-300 rounded-[10px] px-3 py-2 text-sm text-white md:text-slate-900 placeholder:text-slate-500 md:placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">{pitch.length}/2000</div>
                <button
                  onClick={doApply}
                  disabled={!pitch.trim() || busy === "apply"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50"
                >
                  {busy === "apply" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit application
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Applicants list — poster only */}
      {isPoster && (
        <div className="bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-white md:text-slate-900 font-bold text-sm inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Proposals ({apps.length})
            </div>
            {apps.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <ProposalSortDropdown value={appSort} onChange={setAppSort} />
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "pending", "accepted", "rejected"] as const).map((f) => {
                    const count =
                      f === "all" ? apps.length : apps.filter((a) => a.status === f).length;
                    const on = appFilter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setAppFilter(f)}
                        className={`px-2.5 py-1 rounded-[10px] text-[11px] font-bold capitalize border transition-colors ${
                          on
                            ? "bg-emerald-500/20 md:bg-emerald-50 border-emerald-500/50 text-emerald-300 md:text-emerald-700"
                            : "bg-white/5 md:bg-slate-100 border-white/10 md:border-slate-200 text-slate-400 md:text-slate-600 hover:bg-white/10 md:hover:bg-slate-200"
                        }`}
                      >
                        {f} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {apps.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6">
              No applications yet. Share the bounty link to attract solvers.
            </div>
          ) : (
            (() => {
              const filtered =
                appFilter === "all" ? apps : apps.filter((a) => a.status === appFilter);
              const shown = sortProposals(filtered, appSort);
              if (shown.length === 0)
                return (
                  <div className="text-sm text-slate-500 text-center py-6">
                    No {appFilter} proposals.
                  </div>
                );
              return (
                <div className="space-y-3">
                  {shown.map((a) => {
                    const p = profiles[a.applicant_id];
                    const accepted = a.status === "accepted";
                    const rejected = a.status === "rejected";
                    const canAccept = !bounty.accepted_applicant_id && !bounty.released_at;
                    const pill = accepted
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 md:text-emerald-700 md:bg-emerald-50"
                      : rejected
                        ? "bg-white/5 border-white/10 text-slate-400 md:text-slate-500 md:bg-slate-100 md:border-slate-200"
                        : "bg-sky-500/15 border-sky-500/40 text-sky-300 md:text-sky-700 md:bg-sky-50";
                    return (
                      <div
                        key={a.id}
                        className={`rounded-[10px] border p-4 flex flex-col md:flex-row md:items-center gap-3 ${accepted ? "border-emerald-500/50 bg-emerald-500/5 md:bg-emerald-50" : rejected ? "border-white/5 md:border-slate-200 bg-white/5 md:bg-slate-100 opacity-60" : "border-white/10 md:border-slate-200 bg-[#121214] md:bg-slate-50"}`}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 md:border-slate-200 shrink-0">
                          <AvatarImage
                            src={p?.avatar_path ?? null}
                            alt={p?.display_name ?? "Applicant"}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white md:text-slate-900 text-sm font-semibold">
                              {p?.display_name || p?.username || "Applicant"}
                            </span>
                            <span className="text-xs text-slate-500">
                              @{p?.username || p?.slug || "user"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-[10px] border text-[10px] font-bold uppercase tracking-wider ${pill}`}
                            >
                              {accepted ? "Accepted" : rejected ? "Rejected" : "Pending"}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(a.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {a.pitch && (
                            <div className="mt-1 text-sm text-slate-300 md:text-slate-700 whitespace-pre-wrap">
                              {a.pitch}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => openDM(a.applicant_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-xs font-semibold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </button>
                          {canAccept && !accepted && !rejected && (
                            <button
                              onClick={() => setAcceptTarget(a.applicant_id)}
                              disabled={busy === `accept:${a.applicant_id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-50"
                            >
                              {busy === `accept:${a.applicant_id}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Accept
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {acceptTarget && (
        <div
          className="modal-light fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          onClick={() => setAcceptTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="text-white md:text-slate-900 font-bold text-base">
                Accept{" "}
                {profiles[acceptTarget]?.display_name ||
                  profiles[acceptTarget]?.username ||
                  "this applicant"}
                ?
              </div>
            </div>
            <p className="text-white/70 md:text-slate-600 text-sm leading-relaxed mb-4">
              They become the assigned solver for {dp.formatted} in escrow, a chat opens with them,
              and all other proposals are rejected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAcceptTarget(null)}
                className="px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => doAccept(acceptTarget)}
                disabled={!!busy}
                className="px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Yes, assign solver
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSolved && (
        <div
          className="modal-light fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmSolved(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
                <Send className="w-4 h-4 text-sky-300" />
              </div>
              <div className="text-white md:text-slate-900 font-bold text-base">
                Mark work delivered?
              </div>
            </div>
            <p className="text-white/70 md:text-slate-600 text-sm leading-relaxed mb-4">
              The poster will be notified to review your delivery. If they don't confirm within
              <span className="text-white md:text-slate-900 font-semibold"> 48 hours</span>, funds
              will auto-release to your wallet.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmSolved(false)}
                className="px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={doMarkSolved}
                disabled={busy === "solved"}
                className="px-4 py-2 rounded-[10px] bg-sky-500 hover:bg-sky-400 text-black text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy === "solved" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Yes, mark delivered
              </button>
            </div>
          </div>
        </div>
      )}

      {awaitingPop && (
        <div
          className="modal-light fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          onClick={() => setAwaitingPop(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
                <Clock className="w-4 h-4 text-sky-300" />
              </div>
              <div className="text-white md:text-slate-900 font-bold text-base">
                Awaiting poster confirmation
              </div>
            </div>
            <p className="text-white/70 md:text-slate-600 text-sm leading-relaxed mb-4">
              Your delivery is submitted. Waiting for the poster to confirm and approve. You can
              contact the poster via chat to nudge them to approve.
              {autoReleaseIn !== null
                ? ` Funds auto-release in ~${Math.ceil(autoReleaseIn)}h if no response.`
                : ""}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAwaitingPop(false)}
                className="px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setAwaitingPop(false);
                  window.dispatchEvent(new CustomEvent("oventric:open-messages"));
                }}
                className="px-4 py-2 rounded-[10px] bg-sky-500 hover:bg-sky-400 text-black text-sm font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" /> Contact poster
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRelease && (
        <div
          className="modal-light fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmRelease(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1E1E24] md:bg-white border border-white/10 md:border-slate-200 md:shadow-sm shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="text-white md:text-slate-900 font-bold text-base">
                Release {dp.formatted} to the solver?
              </div>
            </div>
            <p className="text-white/70 md:text-slate-600 text-sm leading-relaxed mb-4">
              This confirms the work was delivered okay and releases escrow to the solver's wallet.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRelease(false)}
                className="px-4 py-2 rounded-[10px] bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 border border-white/10 md:border-slate-200 text-white md:text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={doRelease}
                disabled={busy === "release"}
                className="px-4 py-2 rounded-[10px] bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy === "release" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm &amp; release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _keepCurrency = (_c: Currency) => _c;
