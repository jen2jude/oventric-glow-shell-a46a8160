import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ManagementRole } from "./admin-roles";

const VALID_ROLES: ManagementRole[] = ["admin", "moderator", "finance", "content", "support"];

export interface ManagementUserDTO {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  roles: ManagementRole[];
}

async function assertSuperAdmin(ctx: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super-admin only");
}

function sanitizeRoles(input: unknown): ManagementRole[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<ManagementRole>();
  for (const r of input) {
    if (typeof r === "string" && (VALID_ROLES as string[]).includes(r)) {
      out.add(r as ManagementRole);
    }
  }
  return Array.from(out);
}

/** Returns the current signed-in user's management roles. */
export const getMyManagementRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ roles: ManagementRole[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = sanitizeRoles((data ?? []).map((r: { role: string }) => r.role));
    return { roles };
  });

export const listManagementUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagementUserDTO[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { data: roleRows, error } = await sb
      .from("user_roles")
      .select("user_id, role")
      .in("role", VALID_ROLES);
    if (error) throw new Error(error.message);

    const byUser = new Map<string, ManagementRole[]>();
    for (const r of (roleRows ?? []) as { user_id: string; role: ManagementRole }[]) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }

    const userIds = Array.from(byUser.keys());
    if (userIds.length === 0) return [];

    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    const profMap = new Map<string, string | null>();
    for (const p of (profiles ?? []) as { user_id: string; display_name: string | null }[]) {
      profMap.set(p.user_id, p.display_name);
    }

    const results: ManagementUserDTO[] = [];
    for (const uid of userIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userRes } = await (supabaseAdmin as any).auth.admin.getUserById(uid);
      const u = userRes?.user ?? null;
      results.push({
        userId: uid,
        email: u?.email ?? null,
        displayName: profMap.get(uid) ?? null,
        createdAt: u?.created_at ?? null,
        lastSignInAt: u?.last_sign_in_at ?? null,
        roles: sanitizeRoles(byUser.get(uid) ?? []),
      });
    }
    results.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    return results;
  });

export const createManagementUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; password: string; displayName?: string; roles: string[] }) => {
    if (!i?.email || !/^\S+@\S+\.\S+$/.test(i.email)) throw new Error("Valid email required");
    if (!i?.password || i.password.length < 8) throw new Error("Password must be 8+ chars");
    return {
      email: i.email.trim().toLowerCase(),
      password: i.password,
      displayName: i.displayName?.trim() || null,
      roles: sanitizeRoles(i.roles),
    };
  })
  .handler(async ({ data, context }): Promise<{ userId: string }> => {
    await assertSuperAdmin(context);
    if (data.roles.length === 0) throw new Error("Assign at least one role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    // If user already exists, reuse; otherwise create.
    let userId: string | null = null;
    const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = (existing?.users ?? []).find(
      (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === data.email,
    );
    if (found) {
      userId = found.id;
      await sb.auth.admin.updateUserById(userId, { password: data.password, email_confirm: true });
    } else {
      const { data: created, error: cErr } = await sb.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { display_name: data.displayName },
      });
      if (cErr) throw new Error(cErr.message);
      userId = created?.user?.id ?? null;
    }
    if (!userId) throw new Error("Failed to create user");

    // Replace roles
    await sb.from("user_roles").delete().eq("user_id", userId).in("role", VALID_ROLES);
    if (data.roles.length > 0) {
      await sb
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: userId, role })));
    }

    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.management_user.create",
      target_kind: "user",
      target_id: userId,
      meta: { email: data.email, roles: data.roles },
    });
    return { userId };
  });

export const updateManagementUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; roles: string[] }) => ({
    userId: String(i?.userId ?? ""),
    roles: sanitizeRoles(i?.roles),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context);
    if (!data.userId) throw new Error("userId required");
    if (data.userId === context.userId && !data.roles.includes("admin")) {
      throw new Error("You cannot remove your own super-admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    await sb.from("user_roles").delete().eq("user_id", data.userId).in("role", VALID_ROLES);
    if (data.roles.length > 0) {
      await sb
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: data.userId, role })));
    }
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.management_user.update_roles",
      target_kind: "user",
      target_id: data.userId,
      meta: { roles: data.roles },
    });
    return { ok: true };
  });

export const resetManagementUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; password: string }) => {
    if (!i?.userId) throw new Error("userId required");
    if (!i?.password || i.password.length < 8) throw new Error("Password must be 8+ chars");
    return { userId: String(i.userId), password: i.password };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { error } = await sb.auth.admin.updateUserById(data.userId, {
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.management_user.reset_password",
      target_kind: "user",
      target_id: data.userId,
      meta: {},
    });
    return { ok: true };
  });

export const revokeManagementAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => ({ userId: String(i?.userId ?? "") }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context);
    if (!data.userId) throw new Error("userId required");
    if (data.userId === context.userId) throw new Error("You cannot revoke your own access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    await sb.from("user_roles").delete().eq("user_id", data.userId).in("role", VALID_ROLES);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.management_user.revoke",
      target_kind: "user",
      target_id: data.userId,
      meta: {},
    });
    return { ok: true };
  });
