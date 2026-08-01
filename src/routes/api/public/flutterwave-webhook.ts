import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { createHash } from "crypto";
import { verifyAndSettle } from "@/lib/payments/gateway.server";
import { applyPayoutOutcome } from "@/lib/payments/payout-events.server";

/**
 * Flutterwave v3 webhook. Flutterwave authenticates with a static `verif-hash`
 * header rather than a body signature, so the handler re-verifies every charge
 * against the API before any money moves.
 */
export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["FLUTTERWAVE_WEBHOOK_HASH"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const provided = request.headers.get("verif-hash") ?? "";
        try {
          const a = Buffer.from(provided, "utf8");
          const b = Buffer.from(secret, "utf8");
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const raw = await request.text();
        let payload: { event?: string; data?: Record<string, unknown> } = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = String(payload.event ?? "");
        const d = (payload.data ?? {}) as Record<string, unknown>;
        const reference = typeof d.tx_ref === "string" ? d.tx_ref : null;
        const fingerprint = createHash("sha256").update(raw).digest("hex");

        // Idempotency: a content hash of the delivery. Duplicate retries collide
        // on the primary key and short-circuit before any wallet mutation.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: dupErr } = await supabaseAdmin
            .from("flutterwave_webhook_events")
            .insert({ signature: fingerprint, event, reference });
          if (dupErr) {
            if ((dupErr as { code?: string }).code === "23505") {
              return new Response("duplicate", { status: 200 });
            }
            console.error("[flutterwave-webhook] dedupe insert failed", dupErr);
            return new Response("ok", { status: 200 });
          }
        } catch (e) {
          console.error("[flutterwave-webhook] dedupe error", e);
          return new Response("ok", { status: 200 });
        }

        try {
          const status = String(d.status ?? "").toLowerCase();
          if (event === "charge.completed" && reference && status === "successful") {
            await verifyAndSettle(reference);
          } else if (event.startsWith("transfer.")) {
            const outcome = status === "successful" ? "success" : "failed";
            if (status === "pending" || status === "new") {
              return new Response("ok", { status: 200 });
            }
            await applyPayoutOutcome(
              {
                reference,
                transferCode: d.id != null ? String(d.id) : null,
              },
              outcome,
              typeof d.complete_message === "string" ? d.complete_message : null,
            );
          }
        } catch (e) {
          console.error("[flutterwave-webhook] handler error", e);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
