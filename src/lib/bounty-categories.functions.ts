import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface BountyCategory {
  slug: string;
  label: string;
  sort_order: number;
  active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/** Public — list active bounty categories (safe for logged-out visitors). */
export const listBountyCategories = createServerFn({ method: "GET" }).handler(
  async () => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient<Database>(process.env.SUPABASE_URL!, key, {
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
    const { data, error } = await sb
      .from("bounty_categories")
      .select("slug, label, sort_order, active")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as BountyCategory[];
  },
);

/** Admin — list all categories (active or not). */
export const adminListBountyCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("bounty_categories")
      .select("slug, label, sort_order, active")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as BountyCategory[];
  });

/** Admin — upsert a category (create or edit). */
export const adminUpsertBountyCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { slug: string; label: string; sort_order?: number; active?: boolean }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    if (!slug) throw new Error("Slug required");
    if (!data.label?.trim()) throw new Error("Label required");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("bounty_categories").upsert({
      slug,
      label: data.label.trim(),
      sort_order: data.sort_order ?? 100,
      active: data.active ?? true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, slug };
  });

/** Admin — delete a category. */
export const adminDeleteBountyCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { error } = await sb.from("bounty_categories").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
