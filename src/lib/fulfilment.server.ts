/**
 * Server-only helpers for the marketplace payment-fulfilment roadmap.
 * Never import this from a component — only from `.handler()` bodies.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const AUTO_RELEASE_HOURS = 48;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function adminUserIds(sb: any): Promise<string[]> {
  const { data } = await sb.from("user_roles").select("user_id").eq("role", "admin");
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

export async function notify(
  sb: any,
  rows: Array<{
    user_id: string;
    kind: string;
    title: string;
    body: string;
    link?: string | null;
    from_user_id?: string | null;
  }>,
) {
  if (!rows.length) return;
  try {
    await sb.from("notifications").insert(
      rows.map((r) => ({ ...r, link: r.link ?? null, from_user_id: r.from_user_id ?? null })),
    );
  } catch (e) {
    console.error("[fulfilment] notify failed", e);
  }
}

/**
 * Release the escrowed seller share for an order. Idempotent.
 * `by` is the actor: buyer id, admin id, or null for the automatic 48h sweep.
 */
export async function releaseEscrow(
  sb: any,
  orderId: string,
  by: string | null,
  mode: "buyer" | "admin" | "auto",
) {
  const { data: o, error } = await sb
    .from("orders")
    .select("id, buyer_id, seller_id, escrow_status, seller_share_usd, product_id, dispute_status, products:product_id (name)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) throw new Error("Order not found");
  if (o.escrow_status !== "held") return { alreadyReleased: true as const };
  if (o.dispute_status === "open") throw new Error("This order has an open dispute. Funds stay held until it is resolved.");

  const share = Number(o.seller_share_usd ?? 0);
  if (share > 0) {
    const { error: cErr } = await sb.rpc("wallet_credit", { _user_id: o.seller_id, _amount: share });
    if (cErr) throw new Error(cErr.message);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    escrow_status: "released",
    released_at: now,
    released_by: by,
  };
  if (mode !== "admin") patch.buyer_confirmed_at = now;
  await sb.from("orders").update(patch).eq("id", orderId);

  const productName = (o.products?.name as string) ?? "your product";
  const admins = await adminUserIds(sb);
  await notify(sb, [
    {
      user_id: o.seller_id,
      kind: mode === "auto" ? "order_auto_released" : "order_confirmed",
      title: mode === "auto" ? "Funds auto-released" : "Buyer confirmed delivery",
      body:
        mode === "auto"
          ? `The 48-hour confirmation window closed on "${productName}". Your earnings have been credited.`
          : `The buyer confirmed receipt of "${productName}". Your earnings have been credited.`,
      link: `/order/${orderId}`,
    },
    ...admins.map((uid) => ({
      user_id: uid,
      kind: "order_completed",
      title: "Trade circle completed",
      body: `Order ${orderId.slice(0, 8)} — "${productName}" completed and seller wallet funded.`,
      link: `/order/${orderId}`,
    })),
  ]);

  return { alreadyReleased: false as const };
}

/** Sweep every held order whose 48h confirmation window has elapsed. */
export async function autoReleaseDueOrders() {
  const sb = await admin();
  const { data, error } = await sb
    .from("orders")
    .select("id")
    .eq("escrow_status", "held")
    .eq("dispute_status", "none")
    .not("auto_release_at", "is", null)
    .lte("auto_release_at", new Date().toISOString())
    .limit(200);
  if (error) throw new Error(error.message);
  let released = 0;
  for (const r of (data ?? []) as Array<{ id: string }>) {
    try {
      const res = await releaseEscrow(sb, r.id, null, "auto");
      if (!res.alreadyReleased) released += 1;
    } catch (e) {
      console.error("[autoRelease] failed for", r.id, e);
    }
  }
  return { released };
}

/**
 * Warn buyers 12 hours before an escrow auto-release so they can confirm or
 * dispute in time. Idempotent via `prerelease_notified_at`.
 */
export async function notifyPreReleaseDue() {
  const sb = await admin();
  const cutoff = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  const { data, error } = await sb
    .from("orders")
    .select("id, buyer_id, auto_release_at, products:product_id (name)")
    .eq("escrow_status", "held")
    .eq("dispute_status", "none")
    .is("prerelease_notified_at", null)
    .not("auto_release_at", "is", null)
    .lte("auto_release_at", cutoff)
    .gt("auto_release_at", new Date().toISOString())
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, any>>;
  for (const r of rows) {
    const name = (r.products?.name as string) ?? "your order";
    await notify(sb, [
      {
        user_id: r.buyer_id,
        kind: "order_auto_release_soon",
        title: "Auto-confirms in 12 hours",
        body: `"${name}" releases payment to the seller in about 12 hours. Confirm receipt, or open a dispute if you haven't received it.`,
        link: `/order/${r.id}`,
      },
    ]);
    await sb.from("orders").update({ prerelease_notified_at: new Date().toISOString() }).eq("id", r.id);
  }
  return { warned: rows.length };
}
