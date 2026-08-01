/**
 * Provider-agnostic payout outcome handling for transfer webhooks.
 *
 * Both Paystack and Flutterwave notify us asynchronously when a payout lands or
 * fails. Escrow accounting is identical in either case, so the logic lives here
 * and each webhook only has to locate the payout and name the outcome.
 */

export interface PayoutLocator {
  transferCode?: string | null;
  /** Reference of the form PYT_<uuid-without-dashes>. */
  reference?: string | null;
  payoutId?: string | null;
}

function uuidFromReference(reference?: string | null): string | null {
  if (!reference?.startsWith("PYT_")) return null;
  const c = reference.slice(4).replace(/-/g, "");
  if (c.length < 32) return null;
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20, 32)}`;
}

export async function applyPayoutOutcome(
  locator: PayoutLocator,
  outcome: "success" | "failed",
  reason?: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cols = "id, user_id, amount, currency, status";

  let row: Record<string, unknown> | null = null;

  if (locator.payoutId) {
    const { data } = await supabaseAdmin.from("payout_requests").select(cols).eq("id", locator.payoutId).maybeSingle();
    row = data ?? null;
  }
  if (!row && locator.transferCode) {
    const { data } = await supabaseAdmin
      .from("payout_requests")
      .select(cols)
      .or(
        `provider_transfer_code.eq.${locator.transferCode},paystack_transfer_code.eq.${locator.transferCode}`,
      )
      .limit(1);
    row = data?.[0] ?? null;
  }
  if (!row) {
    const uuid = uuidFromReference(locator.reference);
    if (uuid) {
      const { data } = await supabaseAdmin.from("payout_requests").select(cols).eq("id", uuid).maybeSingle();
      row = data ?? null;
    }
  }
  if (!row) {
    console.warn("[payout-events] no matching payout", locator);
    return { matched: false };
  }

  const payoutId = row.id as string;
  const userId = row.user_id as string;
  const amount = Number(row.amount ?? 0);
  const currency = row.currency as string;
  const status = row.status as string;
  const txHash = "PYT-" + payoutId.slice(0, 8);
  const now = new Date().toISOString();

  const { data: w } = await supabaseAdmin
    .from("wallets")
    .select("escrow_balance, available_balance")
    .eq("user_id", userId)
    .eq("currency", currency)
    .maybeSingle();
  const escrow = Number(w?.escrow_balance ?? 0);
  const available = Number(w?.available_balance ?? 0);
  const move = Math.min(escrow, amount);

  if (outcome === "success") {
    if (status === "paid") return { matched: true, alreadyFinal: true };
    await supabaseAdmin
      .from("wallets")
      .update({ escrow_balance: Math.max(0, escrow - move), updated_at: now })
      .eq("user_id", userId)
      .eq("currency", currency);
    await supabaseAdmin
      .from("payout_requests")
      .update({ status: "paid", processed_at: now })
      .eq("id", payoutId);
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "success" })
      .eq("user_id", userId)
      .eq("tx_hash", txHash)
      .eq("type", "Payout Withdrawal");
    return { matched: true, applied: "paid" as const };
  }

  if (status === "rejected" || status === "paid") return { matched: true, alreadyFinal: true };
  await supabaseAdmin
    .from("wallets")
    .update({
      escrow_balance: Math.max(0, escrow - move),
      available_balance: available + move,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("currency", currency);
  await supabaseAdmin
    .from("payout_requests")
    .update({
      status: "rejected",
      reject_reason: (reason || "Transfer failed at the payment provider").slice(0, 200),
      processed_at: now,
    })
    .eq("id", payoutId);
  await supabaseAdmin
    .from("wallet_transactions")
    .update({ status: "failed" })
    .eq("user_id", userId)
    .eq("tx_hash", txHash)
    .eq("type", "Payout Withdrawal");
  return { matched: true, applied: "rejected" as const };
}
