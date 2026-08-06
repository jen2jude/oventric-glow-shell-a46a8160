import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface TopUser {
  userId: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  reputationStars: number;
}

export const getTopUsers = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ users: TopUser[] }> => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, slug, avatar_path, reputation_stars")
      .order("reputation_stars", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[getTopUsers] failed", error);
      return { users: [] };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
    const publishableKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
    const publicClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false }
    });

    const users = await Promise.all((data || []).map(async (row) => {
      let avatarUrl = null;
      if (row.avatar_path) {
        const { data: { publicUrl } } = publicClient.storage.from("avatars").getPublicUrl(row.avatar_path);
        avatarUrl = publicUrl;
      }
      return {
        userId: row.user_id,
        displayName: row.display_name || row.slug,
        slug: row.slug,
        avatarUrl,
        reputationStars: Number(row.reputation_stars || 0),
      };
    }));

    return { users };
  });
