import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface ProductRatingSummary {
  average: number;
  count: number;
  myRating: number | null;
}

function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env missing");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function summarize(
  sb: ReturnType<typeof publicClient>,
  productId: string,
  userId: string | null,
): Promise<ProductRatingSummary> {
  const { data, error } = await sb
    .from("product_reviews")
    .select("user_id, rating")
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const count = rows.length;
  const average = count === 0 ? 0 : rows.reduce((s, r) => s + Number(r.rating), 0) / count;
  const mine = userId ? rows.find((r) => r.user_id === userId) : undefined;
  return {
    average: Math.round(average * 100) / 100,
    count,
    myRating: mine ? Number(mine.rating) : null,
  };
}

/** Public rating summary for a product (myRating always null for anon). */
export const getProductRating = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: string; userId?: string | null }) => d)
  .handler(async ({ data }) => summarize(publicClient(), data.productId, data.userId ?? null));

/** Upsert the signed-in user's star rating for a product. */
export const rateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string; rating: number }) => d)
  .handler(async ({ data, context }) => {
    const rating = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 0)));
    const { error } = await context.supabase
      .from("product_reviews")
      .upsert(
        { product_id: data.productId, user_id: context.userId, rating },
        { onConflict: "product_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return summarize(publicClient(), data.productId, context.userId);
  });
