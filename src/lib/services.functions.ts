import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ServiceInput {
  title: string;
  description: string;
  category?: string | null;
  startingPriceUSD: number;
  originalCurrency?: string;
  originalAmount?: number;
  fxSnapshot?: {
    base: string;
    rates: Record<string, number>;
    source?: string;
    fetched_at?: string;
  } | null;
  coverPath?: string | null;
  deliveryDays?: number | null;
}

/**
 * Authenticated member publishes a service offering. Services are stored as
 * products with kind = 'service' so they reuse orders, reviews and payouts.
 * They enter the same moderation queue as other seller listings.
 */
export const createServiceListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ServiceInput) => ({
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    category: input.category ? String(input.category).trim() : "services",
    startingPriceUSD: Math.max(0, Number(input.startingPriceUSD ?? 0)),
    originalCurrency: String(input.originalCurrency ?? "USD"),
    originalAmount: Math.max(0, Number(input.originalAmount ?? input.startingPriceUSD ?? 0)),
    fxSnapshot: input.fxSnapshot ?? null,
    coverPath: input.coverPath ? String(input.coverPath) : null,
    deliveryDays: input.deliveryDays ? Math.max(1, Number(input.deliveryDays)) : null,
  }))
  .handler(async ({ data, context }) => {
    if (data.title.length < 3) throw new Error("Give your service a clear title");
    if (data.description.length < 20)
      throw new Error("Describe the service in at least 20 characters");
    if (!(data.startingPriceUSD > 0)) throw new Error("Set a starting price");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", context.userId)
      .maybeSingle();
    const vendor =
      ((prof?.display_name as string) || (prof?.username as string) || "Member").trim() || "Member";

    const description = data.deliveryDays
      ? `${data.description}\n\nTypical delivery: ${data.deliveryDays} day${data.deliveryDays === 1 ? "" : "s"}.`
      : data.description;

    const { data: row, error } = await context.supabase
      .from("products")
      .insert({
        seller_id: context.userId,
        name: data.title,
        category: data.category,
        description,
        price_usd: data.startingPriceUSD,
        original_currency: data.originalCurrency,
        original_amount: data.originalAmount,
        fx_snapshot: data.fxSnapshot ? JSON.parse(JSON.stringify(data.fxSnapshot)) : null,
        vendor,
        hue: "from-rose-500 to-red-700",
        cover_path: data.coverPath,
        image_paths: data.coverPath ? [data.coverPath] : [],
        requires_manual_delivery: true,
        promoted: false,
        kind: "service",
        status: isAdmin ? "active" : "pending",
      })
      .select("id, status")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id as string, status: row.status as string };
  });
