import { createFileRoute } from "@tanstack/react-router";

/**
 * One-shot bootstrap: sets the seed admin (jen2jude@gmail.com) password.
 * Self-locks by writing an audit_logs marker; subsequent calls return 410 Gone.
 * Rotate the seed's password afterwards via /admin/management-users.
 */
export const Route = createFileRoute("/api/public/hooks/seed-admin-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { password?: string };
        const password = body?.password;
        if (!password || password.length < 8) {
          return new Response("password (8+ chars) required in JSON body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabaseAdmin as any;

        const { data: used } = await sb
          .from("audit_logs")
          .select("id")
          .eq("action", "admin.seed_password.set")
          .limit(1);
        if ((used ?? []).length > 0) {
          return new Response("Already used — rotate via /admin/management-users", { status: 410 });
        }

        // Find seed admin
        const { data: list, error: lErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (lErr) return new Response(lErr.message, { status: 500 });
        const target = (list?.users ?? []).find(
          (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === "jen2jude@gmail.com",
        );
        if (!target) return new Response("Seed admin not found", { status: 404 });

        const { error: uErr } = await sb.auth.admin.updateUserById(target.id, {
          password,
          email_confirm: true,
        });
        if (uErr) return new Response(uErr.message, { status: 500 });

        await sb.from("audit_logs").insert({
          actor_id: target.id,
          action: "admin.seed_password.set",
          target_kind: "user",
          target_id: target.id,
          meta: { via: "bootstrap-endpoint" },
        });

        return Response.json({ ok: true });
      },
    },
  },
});
