import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  identifier: z.string().trim().min(2).max(254),
});

/**
 * Resolves a login identifier (email OR username) to the account's email so
 * the client can call supabase.auth.signInWithOtp for a RETURNING user only
 * (shouldCreateUser: false). Returns { email } on success.
 *
 * Intentionally returns a generic "No account found" message on miss to avoid
 * confirming username existence via enumeration.
 */
export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    const isEmail = raw.includes("@");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (isEmail) {
      const parsed = z.string().email().safeParse(raw);
      if (!parsed.success) throw new Error("Enter a valid email or username");
      return { email: parsed.data };
    }

    // Username path — look up profile, then fetch email via admin API.
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", raw)
      .maybeSingle();

    if (error) {
      console.error("[resolveLoginIdentifier] profile lookup failed", error);
      throw new Error("Could not look up account. Please try again.");
    }
    if (!profile) {
      throw new Error("No account found for that username");
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      profile.user_id,
    );
    if (userErr || !userRes.user?.email) {
      throw new Error("No account found for that username");
    }
    return { email: userRes.user.email };
  });
