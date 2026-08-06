import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  userId: string;
  user: {
    fullName: string | null;
    avatarUrl: string | null;
    country: string | null;
  };
}

export interface ProductRatingSummary {
  average: number;
  count: number;
  myRating: number | null;
  reviews: ProductReview[];
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
    .select(`
      id,
      user_id,
      rating,
      comment,
      created_at,
      profiles:user_id (
        full_name,
        avatar_url,
        country
      )
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  
  const rows = data ?? [];
  const count = rows.length;
  const average = count === 0 ? 0 : rows.reduce((s, r) => s + Number(r.rating), 0) / count;
  const mine = userId ? rows.find((r) => r.user_id === userId) : undefined;
  
  const reviews: ProductReview[] = rows.map((r: any) => ({
    id: r.id,
    rating: Number(r.rating),
    comment: r.comment,
    createdAt: r.created_at,
    userId: r.user_id,
    user: {
      fullName: r.profiles?.full_name ?? "User",
      avatarUrl: r.profiles?.avatar_url ?? null,
      country: r.profiles?.country ?? null,
    },
  }));

  return {
    average: Math.round(average * 100) / 100,
    count,
    myRating: mine ? Number(mine.rating) : null,
    reviews,
  };
}

/** Public rating summary and reviews for a product. */
export const getProductRating = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: string; userId?: string | null }) => d)
  .handler(async ({ data }) => summarize(publicClient(), data.productId, data.userId ?? null));

/** Upsert the signed-in user's star rating and optional comment for a product. */
export const rateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string; rating: number; comment?: string }) => d)
  .handler(async ({ data, context }) => {
    const rating = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 0)));
    const { error } = await context.supabase
      .from("product_reviews")
      .upsert(
        { 
          product_id: data.productId, 
          user_id: context.userId, 
          rating,
          comment: data.comment || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return summarize(publicClient(), data.productId, context.userId);
  });
