import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface DashboardMetrics {
  totalSales: number;
  totalOrders: number;
  totalRevenueUSD: number;
  totalProducts: number;
  totalFollowers: number;
  totalViews: number;
  engagementRate: number;
  shopVisits: number;
  conversionRate: number;
}

export const getSellerMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardMetrics> => {
    const sb = context.supabase;
    const me = context.userId;

    // In a real app, these would be aggregated from orders, products, analytics, and follows tables.
    // For now, we fetch the core counts.
    const [ordersRes, productsRes, followersRes] = await Promise.all([
      sb.from("orders").select("id, total_usd, status").eq("seller_id", me),
      sb.from("products").select("id", { count: "exact", head: true }).eq("seller_id", me),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", me),
    ]);

    const orders = (ordersRes.data ?? []) as Array<{ total_usd: number; status: string }>;
    const paidOrders = orders.filter(o => ["paid", "delivered", "completed", "released"].includes(o.status));
    
    const totalRevenueUSD = paidOrders.reduce((sum, o) => sum + Number(o.total_usd || 0), 0);

    return {
      totalSales: paidOrders.length,
      totalOrders: orders.length,
      totalRevenueUSD: Number(totalRevenueUSD.toFixed(2)),
      totalProducts: productsRes.count ?? 0,
      totalFollowers: followersRes.count ?? 0,
      totalViews: 0, // Placeholder for analytics
      engagementRate: 0,
      shopVisits: 0,
      conversionRate: 0
    };
  });

export const toggleProductStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ productId: z.string().uuid(), status: z.enum(["active", "pending", "rejected"]) }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const me = context.userId;

    const { error } = await sb
      .from("products")
      .update({ status: data.status })
      .eq("id", data.productId)
      .eq("seller_id", me);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ productId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const me = context.userId;

    // Check if there are orders for this product first
    const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("product_id", data.productId);
    
    if (count && count > 0) {
      // Archive instead of delete if there are orders
      const { error } = await sb
        .from("products")
        .update({ status: "rejected", reject_reason: "Archived by seller" })
        .eq("id", data.productId)
        .eq("seller_id", me);
      if (error) throw new Error(error.message);
      return { success: true, archived: true };
    }

    const { error } = await sb
      .from("products")
      .delete()
      .eq("id", data.productId)
      .eq("seller_id", me);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateShopSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    logoPath: z.string().optional(),
    coverPath: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    about: z.string().optional()
  }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const me = context.userId;

    // These would typically be stored in the profiles table or a dedicated shops table.
    // Given the current schema, we update the profile.
    const { error } = await sb
      .from("profiles")
      .update({
        avatar_path: data.logoPath,
        cover_path: data.coverPath,
        bio: data.description,
        about_me: data.about
      })
      .eq("user_id", me);

    if (error) throw new Error(error.message);
    return { success: true };
  });
