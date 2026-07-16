import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyAndSettleByReference } from "@/lib/paystack.functions";


export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        try {
          const a = Buffer.from(signature, "utf8");
          const b = Buffer.from(expected, "utf8");
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { event?: string; data?: Record<string, unknown> } = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload.event ?? "";
        const d = (payload.data ?? {}) as Record<string, unknown>;

        try {
          if (event === "charge.success" && typeof d.reference === "string") {
            await verifyAndSettleByReference(d.reference);
          } else if (event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed") {
            await settleTransferEvent(event, {
              reference: typeof d.reference === "string" ? d.reference : undefined,
              transfer_code: typeof d.transfer_code === "string" ? d.transfer_code : undefined,
              reason: typeof d.reason === "string" ? d.reason : undefined,
            });
          }
        } catch (e) {
          console.error("[paystack-webhook] handler error", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function settleTransferEvent(
  event: "transfer.success" | "transfer.failed" | "transfer.reversed",
  data: { reference?: string; transfer_code?: string; reason?: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Locate the payout by transfer_code (preferred) or reference-derived id prefix.
  let payoutId: string | null = null;
  let userId: string | null = null;
  let amount: number | null = null;
  let currency: string | null = null;
  let status: string | null = null;

  if (data.transfer_code) {
    const { data: rows } = await supabaseAdmin
      .from("payout_requests")
      .select("id, user_id, amount, currency, status")
      .eq("paystack_transfer_code", data.transfer_code)
      .limit(1);
    if (rows?.[0]) {
      payoutId = rows[0].id as string;
      userId = rows[0].user_id as string;
      amount = Number(rows[0].amount);
      currency = rows[0].currency as string;
      status = rows[0].status as string;
    }
  }
  if (!payoutId && data.reference?.startsWith("PYT_")) {
    const compact = data.reference.slice(4);
    // Reconstruct with dashes: 8-4-4-4-12
    if (compact.length >= 32) {
      const uuid = `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`;
      const { data: row } = await supabaseAdmin
        .from("payout_requests")
        .select("id, user_id, amount, currency, status")
        .eq("id", uuid)
        .maybeSingle();
      if (row) {
        payoutId = row.id as string;
        userId = row.user_id as string;
        amount = Number(row.amount);
        currency = row.currency as string;
        status = row.status as string;
      }
    }
  }
  if (!payoutId || !userId || amount == null || !currency) {
    console.warn("[paystack-webhook][transfer] no matching payout", data);
    return;
  }

  if (event === "transfer.success") {
    if (status === "paid") return;
    // Decrement escrow by this payout's amount; mark paid; success the wallet tx.
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("escrow_balance")
      .eq("user_id", userId)
      .eq("currency", currency)
      .maybeSingle();
    const currEscrow = Number(w?.escrow_balance ?? 0);
    const newEscrow = Math.max(0, currEscrow - amount);
    await supabaseAdmin
      .from("wallets")
      .update({ escrow_balance: newEscrow, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("currency", currency);

    await supabaseAdmin
      .from("payout_requests")
      .update({ status: "paid", processed_at: new Date().toISOString() })
      .eq("id", payoutId);

    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "success" })
      .eq("user_id", userId)
      .eq("tx_hash", "PYT-" + payoutId.slice(0, 8))
      .eq("type", "Payout Withdrawal");
  } else {
    // failed or reversed -> refund escrow -> available, mark rejected, fail the wallet tx.
    if (status === "rejected" || status === "paid") return;
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("escrow_balance, available_balance")
      .eq("user_id", userId)
      .eq("currency", currency)
      .maybeSingle();
    const currEscrow = Number(w?.escrow_balance ?? 0);
    const currAvail = Number(w?.available_balance ?? 0);
    const move = Math.min(currEscrow, amount);
    await supabaseAdmin
      .from("wallets")
      .update({
        escrow_balance: Math.max(0, currEscrow - move),
        available_balance: currAvail + move,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("currency", currency);
    await supabaseAdmin
      .from("payout_requests")
      .update({
        status: "rejected",
        reject_reason: (data.reason || `Paystack ${event}`).slice(0, 200),
        processed_at: new Date().toISOString(),
      })
      .eq("id", payoutId);
    await supabaseAdmin
      .from("wallet_transactions")
      .update({ status: "failed" })
      .eq("user_id", userId)
      .eq("tx_hash", "PYT-" + payoutId.slice(0, 8))
      .eq("type", "Payout Withdrawal");
  }
}

