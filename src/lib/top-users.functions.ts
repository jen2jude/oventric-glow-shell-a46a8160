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

    const users = await Promise.all((data || []).map(async (row) => {
      let avatarUrl = null;
      if (row.avatar_path) {
        // Try to get a long-lived signed URL (1 week) since this is a leaderboard
        const { data: signed } = await supabaseAdmin.storage
          .from("avatars")
          .createSignedUrl(row.avatar_path, 60 * 60 * 24 * 7);
        avatarUrl = signed?.signedUrl || null;

        // Fallback to public URL if signing failed (e.g. bucket settings)
        if (!avatarUrl) {
          const { data: pub } = supabaseAdmin.storage.from("avatars").getPublicUrl(row.avatar_path);
          avatarUrl = pub.publicUrl || null;
        }
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
