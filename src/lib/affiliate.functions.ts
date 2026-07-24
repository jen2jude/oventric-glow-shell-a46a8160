import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AffiliateReservationDTO {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  country: string | null;
  note: string | null;
  createdAt: string;
}

async function assertAdmin(ctx: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getMyAffiliateReservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AffiliateReservationDTO | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("affiliate_reservations")
      .select("id, user_id, email, display_name, country, note, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      email: data.email,
      displayName: data.display_name,
      country: data.country,
      note: data.note,
      createdAt: data.created_at,
    };
  });

export const reserveAffiliateSpot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { note?: string }) => ({ note: (i?.note ?? "").toString().slice(0, 500) }))
  .handler(async ({ data, context }): Promise<AffiliateReservationDTO> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const claims = context.claims as { email?: string } | undefined;
    const email = claims?.email ?? "";

    // Pull profile for display_name + country
    const { data: prof } = await sb
      .from("profiles")
      .select("display_name, username, country")
      .eq("user_id", context.userId)
      .maybeSingle();

    const displayName = prof?.display_name ?? prof?.username ?? null;
    const country = prof?.country ?? null;

    const { data: row, error } = await sb
      .from("affiliate_reservations")
      .upsert(
        {
          user_id: context.userId,
          email,
          display_name: displayName,
          country,
          note: data.note || null,
        },
        { onConflict: "user_id" },
      )
      .select("id, user_id, email, display_name, country, note, created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      country: row.country,
      note: row.note,
      createdAt: row.created_at,
    };
  });

export const listAffiliateReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AffiliateReservationDTO[]> => {
    await assertAdmin(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("affiliate_reservations")
      .select("id, user_id, email, display_name, country, note, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      userId: r.user_id as string,
      email: r.email as string,
      displayName: (r.display_name as string) ?? null,
      country: (r.country as string) ?? null,
      note: (r.note as string) ?? null,
      createdAt: r.created_at as string,
    }));
  });
