import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* -------------------------------------------------------------------------- */
/*  Usage analytics summary (posts, followers, sales/orders, wallet volume)   */
/* -------------------------------------------------------------------------- */

export interface UsageAnalytics {
  posts: number;
  followers: number;
  following: number;
  ordersPlaced: number;
  ordersSold: number;
  walletVolumeUSD: number;
}

export const getUsageAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageAnalytics> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;

    const [postsRes, followersRes, followingRes, ordersRes, salesRes, walletTxRes] = await Promise.all([
      sb.from("posts").select("id", { count: "exact", head: true }).eq("author_id", me),
      sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", me),
      sb.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", me),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", me),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", me),
      sb.from("wallet_transactions").select("amount").eq("user_id", me).eq("status", "success"),
    ]);

    const walletVolumeUSD = ((walletTxRes.data ?? []) as Array<{ amount: number }>).reduce(
      (sum, r) => sum + Math.abs(Number(r.amount || 0)),
      0,
    );

    return {
      posts: postsRes.count ?? 0,
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      ordersPlaced: ordersRes.count ?? 0,
      ordersSold: salesRes.count ?? 0,
      walletVolumeUSD: Number(walletVolumeUSD.toFixed(2)),
    };
  });

/* -------------------------------------------------------------------------- */
/*  Activity time series for charts (posts / orders / wallet volume by day)  */
/* -------------------------------------------------------------------------- */

export interface ActivityPoint {
  date: string; // YYYY-MM-DD
  posts: number;
  orders: number;
  walletVolumeUSD: number;
}

const RANGE_DAYS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_DAYS)[number];

export const getActivityTimeseries = createServerFn({ method: "GET" })
  .inputValidator((i: { rangeDays: RangeDays }) => i)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ActivityPoint[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const me = context.userId;
    const rangeDays = RANGE_DAYS.includes(data.rangeDays) ? data.rangeDays : 30;

    const since = new Date();
    since.setDate(since.getDate() - (rangeDays - 1));
    since.setHours(0, 0, 0, 0);
    const sinceISO = since.toISOString();

    const [postsRes, ordersBuyerRes, ordersSellerRes, walletTxRes] = await Promise.all([
      sb.from("posts").select("created_at").eq("author_id", me).gte("created_at", sinceISO),
      sb.from("orders").select("created_at").eq("buyer_id", me).gte("created_at", sinceISO),
      sb.from("orders").select("created_at").eq("seller_id", me).gte("created_at", sinceISO),
      sb.from("wallet_transactions").select("created_at, amount").eq("user_id", me).eq("status", "success").gte("created_at", sinceISO),
    ]);

    // Build a day bucket map so the chart always has a continuous series.
    const buckets = new Map<string, ActivityPoint>();
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, posts: 0, orders: 0, walletVolumeUSD: 0 });
    }
    const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

    for (const r of (postsRes.data ?? []) as Array<{ created_at: string }>) {
      const b = buckets.get(dayKey(r.created_at));
      if (b) b.posts += 1;
    }
    for (const r of [...(ordersBuyerRes.data ?? []), ...(ordersSellerRes.data ?? [])] as Array<{ created_at: string }>) {
      const b = buckets.get(dayKey(r.created_at));
      if (b) b.orders += 1;
    }
    for (const r of (walletTxRes.data ?? []) as Array<{ created_at: string; amount: number }>) {
      const b = buckets.get(dayKey(r.created_at));
      if (b) b.walletVolumeUSD += Math.abs(Number(r.amount || 0));
    }

    return Array.from(buckets.values()).map((b) => ({ ...b, walletVolumeUSD: Number(b.walletVolumeUSD.toFixed(2)) }));
  });
