import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  identifier: z.string().trim().min(2).max(254),
});

const PasswordInput = z.object({
  identifier: z.string().trim().min(2).max(254),
  password: z.string().min(6).max(200),
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email";
  const localMasked = local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "***";
  const [dName, ...rest] = domain.split(".");
  const dMasked = dName.length <= 2 ? dName[0] + "*" : dName[0] + "***";
  return `${localMasked}@${dMasked}${rest.length ? "." + rest.join(".") : ""}`;
}

async function resolveEmail(raw: string): Promise<string | null> {
  const isEmail = raw.includes("@");
  if (isEmail) {
    const parsed = z.string().email().safeParse(raw);
    return parsed.success ? parsed.data : null;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("username", raw)
    .maybeSingle();
  if (!profile) return null;
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
  return userRes.user?.email ?? null;
}

/**
 * Server-side OTP dispatch by email OR username.
 * Never returns the raw email — only a masked hint — to prevent username→email
 * enumeration via the client. Always returns a generic success shape regardless
 * of whether the account exists (still returns a masked hint only on hit).
 */
export const sendLoginOtpByIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    const email = await resolveEmail(raw);
    if (!email) {
      // Return a generic success shape so callers cannot enumerate accounts
      // by observing error vs success differences.
      return { ok: true, sent: false, maskedEmail: null as string | null };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      // Swallow provider details; log server-side for operators.
      console.error("[sendLoginOtpByIdentifier] otp send failed", error);
      return { ok: true, sent: false, maskedEmail: null as string | null };
    }
    return { ok: true, sent: true, maskedEmail: maskEmail(email) };
  });

/**
 * Server-side password sign-in by email OR username.
 * Returns session tokens which the client applies via supabase.auth.setSession().
 * Raw email is never returned; a masked hint is included only on success.
 */
export const signInWithIdentifierPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PasswordInput.parse(input))
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    const email = await resolveEmail(raw);
    // Uniform failure response to avoid revealing whether the identifier exists.
    const fail = { ok: false as const, session: null, maskedEmail: null as string | null };
    if (!email) return fail;
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: sess, error } = await sb.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !sess.session) return fail;
    return {
      ok: true as const,
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
      },
      maskedEmail: maskEmail(email),
    };
  });

const VerifyInput = z.object({
  identifier: z.string().trim().min(2).max(254),
  token: z.string().trim().regex(/^\d{4,10}$/),
});

/**
 * Server-side email OTP verification by identifier. Resolves username → email
 * server-side, calls verifyOtp, and returns the resulting session tokens for
 * the client to apply via supabase.auth.setSession(). Raw email is never
 * returned to the client.
 */
export const verifyLoginOtpByIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data }) => {
    const email = await resolveEmail(data.identifier.trim());
    const fail = { ok: false as const, session: null };
    if (!email) return fail;
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: res, error } = await sb.auth.verifyOtp({
      email,
      token: data.token,
      type: "email",
    });
    if (error || !res.session) return fail;
    return {
      ok: true as const,
      session: {
        access_token: res.session.access_token,
        refresh_token: res.session.refresh_token,
      },
    };
  });
