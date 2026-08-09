import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface ToolCategoryDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ToolDTO {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertToolsAdmin(ctx: { supabase: any; userId: string }) {
  for (const role of ["admin", "content"] as const) {
    const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
    if (data) return;
  }
  throw new Error("Forbidden: admin role required");
}

const slugify = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Public — the tools library grouped by category, for the profile picker. */
export const listToolLibrary = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: ToolCategoryDTO[]; tools: ToolDTO[] }> => {
    const sb = publicClient();
    const [cats, tools] = await Promise.all([
      sb
        .from("tool_categories")
        .select("id, name, slug, image_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      sb
        .from("tools")
        .select("id, category_id, name, slug, image_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    const categories = (cats.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.image_url,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    }));
    const byId = new Map(categories.map((c) => [c.id, c]));
    const rows = (tools.data ?? [])
      .filter((t) => byId.has(t.category_id))
      .map((t) => {
        const cat = byId.get(t.category_id)!;
        return {
          id: t.id,
          categoryId: t.category_id,
          categorySlug: cat.slug,
          categoryName: cat.name,
          name: t.name,
          slug: t.slug,
          imageUrl: t.image_url,
          sortOrder: t.sort_order,
          isActive: t.is_active,
        };
      });
    return { categories, tools: rows };
  },
);

/** Admin — everything, including inactive rows. */
export const adminListToolLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ categories: ToolCategoryDTO[]; tools: ToolDTO[] }> => {
    await assertToolsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [cats, tools] = await Promise.all([
      supabaseAdmin
        .from("tool_categories")
        .select("id, name, slug, image_url, sort_order, is_active")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("tools")
        .select("id, category_id, name, slug, image_url, sort_order, is_active")
        .order("sort_order", { ascending: true }),
    ]);
    const categories = (cats.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.image_url,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    }));
    const byId = new Map(categories.map((c) => [c.id, c]));
    const rows = (tools.data ?? []).map((t) => ({
      id: t.id,
      categoryId: t.category_id,
      categorySlug: byId.get(t.category_id)?.slug ?? "",
      categoryName: byId.get(t.category_id)?.name ?? "Unknown",
      name: t.name,
      slug: t.slug,
      imageUrl: t.image_url,
      sortOrder: t.sort_order,
      isActive: t.is_active,
    }));
    return { categories, tools: rows };
  });

/** Admin — create or edit a tool category (image is a URL). */
export const adminSaveToolCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      name: string;
      imageUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertToolsAdmin(context);
    const name = data.name.trim().slice(0, 60);
    if (!name) throw new Error("Name is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      name,
      slug: slugify(name),
      image_url: data.imageUrl?.trim() || null,
      sort_order: data.sortOrder ?? 100,
      is_active: data.isActive ?? true,
    };
    const q = data.id
      ? supabaseAdmin.from("tool_categories").update(patch).eq("id", data.id)
      : supabaseAdmin.from("tool_categories").insert(patch);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin — create or edit a tool inside a category. */
export const adminSaveTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      categoryId: string;
      name: string;
      imageUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertToolsAdmin(context);
    const name = data.name.trim().slice(0, 60);
    if (!name) throw new Error("Name is required");
    if (!data.categoryId) throw new Error("Category is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      category_id: data.categoryId,
      name,
      slug: slugify(name),
      image_url: data.imageUrl?.trim() || null,
      sort_order: data.sortOrder ?? 100,
      is_active: data.isActive ?? true,
    };
    const q = data.id
      ? supabaseAdmin.from("tools").update(patch).eq("id", data.id)
      : supabaseAdmin.from("tools").insert(patch);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin — remove a category (and its tools) or a single tool. */
export const adminDeleteToolEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { kind: "category" | "tool"; id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertToolsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.kind === "category" ? "tool_categories" : "tools";
    const { error } = await supabaseAdmin.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
