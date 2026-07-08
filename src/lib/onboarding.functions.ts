import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  username: z.string().trim().min(2).max(24).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});

const WALLET_CURRENCIES = ["USD", "NGN", "GHS"] as const;

/**
 * Idempotently seeds a profile row and the three multi-currency wallet rows for
 * the authenticated user. Safe to call multiple times (after signup, on
 * first sign-in, or as a self-heal path from the app shell).
 */
export const seedNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const email = (claims as { email?: string } | undefined)?.email ?? "";
    const emailLocal = email.split("@")[0] || "architect";
    const fallbackName = data.displayName ?? emailLocal;
    const desiredUsername = data.username ?? emailLocal;
    const slugBase =
      desiredUsername
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 24) || "architect";

    // 1. Profile (insert-if-missing; do NOT overwrite existing user edits)
    const { data: existing, error: readErr } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) {
      console.error("[seedNewUser] profile read failed", readErr);
      throw new Error("Failed to prepare profile");
    }

    if (!existing) {
      const { error: insErr } = await supabase.from("profiles").insert({
        user_id: userId,
        slug: slugBase,
        display_name: fallbackName,
        username: desiredUsername,
        verification_tier: "TIER_0",
        reputation_stars: 5.0,
      });
      // 23505 = unique_violation (username or slug collision). We retry once
      // with a suffix so seeding never blocks signup.
      if (insErr && (insErr as { code?: string }).code === "23505") {
        const suffix = Math.random().toString(36).slice(2, 6);
        const { error: retryErr } = await supabase.from("profiles").insert({
          user_id: userId,
          slug: `${slugBase}${suffix}`,
          display_name: fallbackName,
          username: `${desiredUsername}-${suffix}`,
          verification_tier: "TIER_0",
          reputation_stars: 5.0,
        });
        if (retryErr) {
          console.error("[seedNewUser] profile insert retry failed", retryErr);
          throw new Error("Failed to create profile");
        }
      } else if (insErr) {
        console.error("[seedNewUser] profile insert failed", insErr);
        throw new Error("Failed to create profile");
      }
    }

    // 2. Wallets (one row per currency; UNIQUE(user_id, currency) makes this idempotent)
    const rows = WALLET_CURRENCIES.map((currency) => ({
      user_id: userId,
      currency,
      available_balance: 0,
      escrow_balance: 0,
      accumulated_cashback: 0,
    }));
    const { error: walletErr } = await supabase
      .from("wallets")
      .upsert(rows, { onConflict: "user_id,currency", ignoreDuplicates: true });
    if (walletErr) {
      console.error("[seedNewUser] wallet upsert failed", walletErr);
      throw new Error("Failed to initialize wallets");
    }

    return { ok: true, userId };
  });
