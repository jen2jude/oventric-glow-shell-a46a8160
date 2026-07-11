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

        let payload: { event?: string; data?: { reference?: string } } = {};
        try { payload = JSON.parse(raw); } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (payload.event === "charge.success" && payload.data?.reference) {
          try {
            await verifyAndSettleByReference(payload.data.reference);
          } catch (e) {
            // Don't leak internals; return 200 so Paystack doesn't retry
            // forever when the error is deterministic. Log for observability.
            console.error("[paystack-webhook] settle failed", e);
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
