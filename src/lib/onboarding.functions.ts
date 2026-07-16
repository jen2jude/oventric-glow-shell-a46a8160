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
    const isAnonymous = Boolean(
      (claims as { is_anonymous?: boolean } | undefined)?.is_anonymous,
    );

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
      const tryInsert = async (slug: string, uname: string) =>
        supabase.from("profiles").insert({
          user_id: userId,
          slug,
          display_name: fallbackName,
          username: uname,
          verification_tier: "TIER_0",
          reputation_stars: 0,
        });

      let { error: insErr } = await tryInsert(slugBase, desiredUsername);
      // Retry a few times on unique-violation (slug/username collisions or
      // a concurrent seed that just wrote the row).
      for (let i = 0; insErr && (insErr as { code?: string }).code === "23505" && i < 3; i++) {
        // If the row already exists for this user, we're done.
        const { data: found } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (found) {
          insErr = null as unknown as typeof insErr;
          break;
        }
        const suffix = Math.random().toString(36).slice(2, 6);
        ({ error: insErr } = await tryInsert(`${slugBase}${suffix}`, `${desiredUsername}-${suffix}`));
      }
      if (insErr) {
        console.error("[seedNewUser] profile insert failed", insErr);
        throw new Error("Failed to create profile");
      }
    }


    // 2. Wallets (only for real, non-anonymous users — RLS blocks anon inserts,
    // and anon browse-only sessions don't need wallet rows until they upgrade).
    if (!isAnonymous) {
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
        // Non-fatal: profile is seeded; wallets can be created on first
        // commerce action. Do not blank the app shell over this.
        console.error("[seedNewUser] wallet upsert failed (non-fatal)", walletErr);
      }
    }

    return { ok: true, userId };
  });

const FullNameInput = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
});

/**
 * Persists the user's full name onto their profile's display_name. Used by
 * the "fill your full name" gate that fires before create actions.
 */
export const updateFullName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FullNameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: data.fullName })
      .eq("user_id", userId);
    if (error) {
      console.error("[updateFullName] update failed", error);
      throw new Error("Failed to save full name");
    }
    return { ok: true, fullName: data.fullName };
  });

const CompleteProfileInput = z.object({
  fullName: z.string().trim().min(2).max(80),
  country: z.enum(["NG", "GH", "US", "UK", "OTHER"]),
  address: z.string().trim().min(4, "Enter a valid address").max(240),
  phone: z.string().trim().min(6, "Enter a valid phone").max(24),
});

/**
 * Stage 2 onboarding: persists full name, country, address, and phone, and
 * promotes verification_tier from TIER_1 → TIER_2 so commerce actions
 * (buy, sell, wallet, bounty apply, campaign issue) unlock.
 */
export const completeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompleteProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.fullName,
        country: data.country,
        address: data.address,
        phone: data.phone,
        verification_tier: "TIER_2",
        profile_completed_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) {
      console.error("[completeProfile] update failed", error);
      throw new Error("Failed to save profile");
    }
    return { ok: true };
  });


/**
 * Reads the current user's profile-completion + kyc status. Used by gates to
 * decide whether to show the setup / kyc modals.
 */
export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "display_name, country, phone, profile_completed_at, kyc_completed_at, kyc_selfie_path, kyc_id_path, verification_tier",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[getOnboardingStatus] read failed", error);
      throw new Error("Failed to read profile status");
    }
    return {
      profileCompleted: !!data?.profile_completed_at,
      kycCompleted: !!data?.kyc_completed_at,
      displayName: data?.display_name ?? null,
      country: data?.country ?? null,
      phone: data?.phone ?? null,
      kycSelfiePath: data?.kyc_selfie_path ?? null,
      kycIdPath: (data as { kyc_id_path?: string | null } | null)?.kyc_id_path ?? null,
      verificationTier: (data as { verification_tier?: string } | null)?.verification_tier ?? "TIER_0",
    };
  });


const SaveKycInput = z.object({
  phone: z.string().trim().min(6).max(24),
  selfiePath: z.string().trim().min(1).max(400),
  idPath: z.string().trim().min(1).max(400),
});

/**
 * Persists the KYC selfie + government ID paths and phone, marks
 * kyc_completed_at, and promotes verification_tier to TIER_5.
 * Both images are uploaded from the browser to the private `kyc-selfies`
 * bucket (paths: `<user_id>/selfie_<ts>.jpg` and `<user_id>/id_<ts>.jpg`).
 */
export const saveKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveKycInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        phone: data.phone,
        kyc_selfie_path: data.selfiePath,
        kyc_id_path: data.idPath,
        kyc_completed_at: new Date().toISOString(),
        verification_tier: "TIER_5",
      })
      .eq("user_id", userId);
    if (error) {
      console.error("[saveKyc] update failed", error);
      throw new Error("Failed to save KYC");
    }
    return { ok: true };
  });

