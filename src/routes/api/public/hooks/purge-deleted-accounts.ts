import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron: hard-delete auth users whose profile was soft-deleted
 * more than 30 days ago. Called by pg_cron with the anon `apikey` header;
 * `/api/public/*` bypasses the site auth gate.
 */
export const Route = createFileRoute("/api/public/hooks/purge-deleted-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        // Best-effort caller check — cron includes the anon apikey.
        if (!anon) return new Response("misconfigured", { status: 500 });

        const apiKey = request.headers.get("apikey") ?? "";
        if (apiKey !== anon) {
          return new Response("unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();

        const { data: rows, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, deleted_at")
          .not("deleted_at", "is", null)
          .lt("deleted_at", cutoff)
          .limit(200);
        if (error) {
          console.error("[purge-deleted-accounts] list failed", error);
          return new Response("list failed", { status: 500 });
        }

        let deleted = 0;
        let failed = 0;
        for (const row of rows ?? []) {
          const uid = (row as { user_id: string }).user_id;
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(uid, false);
          if (delErr) {
            console.error("[purge-deleted-accounts] delete failed", uid, delErr);
            failed++;
          } else {
            deleted++;
          }
        }
        return Response.json({ ok: true, deleted, failed, considered: rows?.length ?? 0 });
      },
    },
  },
});
