import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CircleRole = "owner" | "admin" | "member";
export type JoinStatus = "none" | "pending" | "member";

const CircleIdInput = z.object({ circleId: z.string().uuid() });
const UserInput = z.object({ userId: z.string().uuid() });

const CreateCircleInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(),
  isPrivate: z.boolean().optional(),
  avatarUrl: z.string().url().max(600).optional(),
});

const UpdateCircleInput = z.object({
  circleId: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isPrivate: z.boolean().optional(),
  avatarUrl: z.string().url().max(600).nullable().optional(),
});

const RequestActionInput = z.object({
  requestId: z.string().uuid(),
});

export interface CircleSummary {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  memberCount: number;
  myRole: CircleRole | null;
  myStatus: JoinStatus;
  createdAt: string;
}

export interface CircleJoinRequestRow {
  id: string;
  circleId: string;
  circleName: string;
  circleSlug: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string | null;
  requesterSlug: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `circle-${Math.random().toString(36).slice(2, 8)}`;
}

async function annotateCircles(supabase: any, meId: string, rows: any[]): Promise<CircleSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [countsRes, myMembership, myReqs] = await Promise.all([
    supabase.from("circle_members").select("circle_id", { count: "exact" }).in("circle_id", ids),
    supabase.from("circle_members").select("circle_id, role").eq("user_id", meId).in("circle_id", ids),
    supabase
      .from("circle_join_requests")
      .select("circle_id, status")
      .eq("requester_id", meId)
      .in("circle_id", ids)
      .eq("status", "pending"),
  ]);

  // count members per circle
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  const { data: allMembers } = await supabase
    .from("circle_members")
    .select("circle_id")
    .in("circle_id", ids);
  (allMembers ?? []).forEach((m: any) => counts.set(m.circle_id, (counts.get(m.circle_id) ?? 0) + 1));

  const roleMap = new Map<string, CircleRole>((myMembership.data ?? []).map((r: any) => [r.circle_id, r.role]));
  const pendingSet = new Set<string>((myReqs.data ?? []).map((r: any) => r.circle_id));

  return rows.map((r) => {
    const myRole = roleMap.get(r.id) ?? null;
    const myStatus: JoinStatus = myRole ? "member" : pendingSet.has(r.id) ? "pending" : "none";
    return {
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      avatarUrl: r.avatar_url,
      isPrivate: r.is_private,
      memberCount: counts.get(r.id) ?? 0,
      myRole,
      myStatus,
      createdAt: r.created_at,
    } satisfies CircleSummary;
  });
}

export const createCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateCircleInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleSummary> => {
    const me = context.userId;
    const base = slugify(data.name);
    let slug = base;
    for (let i = 0; i < 6; i++) {
      const { data: row, error } = await context.supabase
        .from("circles")
        .insert({
          owner_id: me,
          name: data.name,
          slug,
          description: data.description ?? null,
          avatar_url: data.avatarUrl ?? null,
          is_private: data.isPrivate ?? false,
        })
        .select("*")
        .single();
      if (!error && row) {
        const [annotated] = await annotateCircles(context.supabase, me, [row]);
        return annotated;
      }
      const code = (error as any)?.code;
      if (code === "23505") {
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      console.error("[createCircle]", error);
      throw new Error("Failed to create circle");
    }
    throw new Error("Could not allocate a unique slug");
  });

export const updateCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateCircleInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.isPrivate !== undefined) patch.is_private = data.isPrivate;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("circles").update(patch).eq("id", data.circleId);
    if (error) throw new Error("Failed to update circle");
    return { ok: true };
  });

export const deleteCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("circles").delete().eq("id", data.circleId);
    if (error) throw new Error("Failed to delete circle");
    return { ok: true } as const;
  });

/** Circles I own OR am a member of. */
export const listMyCircles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CircleSummary[]> => {
    const me = context.userId;
    const { data: memberships } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", me);
    const ids = (memberships ?? []).map((r: any) => r.circle_id);
    if (ids.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("circles")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return annotateCircles(context.supabase, me, rows ?? []);
  });

/** Circles a given user belongs to (public + private the viewer can see via RLS). */
export const listCirclesForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UserInput.parse(d))
  .handler(async ({ data, context }): Promise<CircleSummary[]> => {
    const { data: memberships } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", data.userId);
    const ids = (memberships ?? []).map((r: any) => r.circle_id);
    if (ids.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("circles")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return annotateCircles(context.supabase, context.userId, rows ?? []);
  });

export const requestJoinCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }): Promise<{ status: JoinStatus }> => {
    const me = context.userId;
    // Already a member?
    const { data: existing } = await context.supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", data.circleId)
      .eq("user_id", me)
      .maybeSingle();
    if (existing) return { status: "member" };
    const { error } = await context.supabase
      .from("circle_join_requests")
      .upsert(
        { circle_id: data.circleId, requester_id: me, status: "pending" },
        { onConflict: "circle_id,requester_id", ignoreDuplicates: false },
      );
    if (error) {
      console.error("[requestJoinCircle]", error);
      throw new Error("Failed to send join request");
    }
    return { status: "pending" };
  });

export const cancelJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("circle_join_requests")
      .delete()
      .eq("circle_id", data.circleId)
      .eq("requester_id", context.userId);
    if (error) throw new Error("Failed to cancel");
    return { ok: true } as const;
  });

export const leaveCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CircleIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: circ } = await context.supabase
      .from("circles")
      .select("owner_id")
      .eq("id", data.circleId)
      .maybeSingle();
    if (circ && circ.owner_id === context.userId) {
      throw new Error("Owner can't leave — delete the circle instead");
    }
    const { error } = await context.supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", data.circleId)
      .eq("user_id", context.userId);
    if (error) throw new Error("Failed to leave");
    return { ok: true } as const;
  });

export const listIncomingCircleJoinRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CircleJoinRequestRow[]> => {
    const me = context.userId;
    // Circles where I'm owner/admin
    const { data: myAdmin } = await context.supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", me)
      .in("role", ["owner", "admin"]);
    const adminCircleIds = (myAdmin ?? []).map((r: any) => r.circle_id);
    if (adminCircleIds.length === 0) return [];

    const { data: reqs, error } = await context.supabase
      .from("circle_join_requests")
      .select("id, circle_id, requester_id, status, created_at")
      .in("circle_id", adminCircleIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!reqs || reqs.length === 0) return [];

    const [circlesRes, profilesRes] = await Promise.all([
      context.supabase.from("circles").select("id, name, slug").in("id", adminCircleIds),
      context.supabase
        .from("profiles")
        .select("user_id, display_name, username, slug, avatar_url")
        .in(
          "user_id",
          reqs.map((r: any) => r.requester_id),
        ),
    ]);
    const cMap = new Map((circlesRes.data ?? []).map((c: any) => [c.id, c]));
    const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.user_id, p]));

    return reqs.map((r: any) => {
      const c = cMap.get(r.circle_id) as any;
      const p = pMap.get(r.requester_id) as any;
      return {
        id: r.id,
        circleId: r.circle_id,
        circleName: c?.name ?? "Circle",
        circleSlug: c?.slug ?? "",
        requesterId: r.requester_id,
        requesterName: p?.display_name || p?.username || "Someone",
        requesterAvatar: p?.avatar_url ?? null,
        requesterSlug: p?.slug ?? null,
        status: r.status,
        createdAt: r.created_at,
      };
    });
  });

export const acceptJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestActionInput.parse(d))
  .handler(async ({ data, context }) => {
    // Load request & authorize (RLS also enforces)
    const { data: req, error: rErr } = await context.supabase
      .from("circle_join_requests")
      .select("id, circle_id, requester_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (rErr || !req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Request already handled");

    const { error: mErr } = await context.supabase
      .from("circle_members")
      .insert({ circle_id: req.circle_id, user_id: req.requester_id, role: "member" });
    if (mErr && (mErr as any).code !== "23505") {
      console.error("[acceptJoinRequest] member insert", mErr);
      throw new Error("Failed to add member");
    }
    const { error: uErr } = await context.supabase
      .from("circle_join_requests")
      .update({ status: "accepted" })
      .eq("id", data.requestId);
    if (uErr) throw new Error("Failed to update request");
    return { ok: true } as const;
  });

export const declineJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestActionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("circle_join_requests")
      .update({ status: "declined" })
      .eq("id", data.requestId);
    if (error) throw new Error("Failed to decline");
    return { ok: true } as const;
  });
