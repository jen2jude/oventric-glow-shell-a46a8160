import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://oventric.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/about", changefreq: "monthly", priority: "0.7" },
          { path: "/faq", changefreq: "monthly", priority: "0.7" },
          { path: "/help", changefreq: "monthly", priority: "0.6" },
          { path: "/help-board", changefreq: "monthly", priority: "0.5" },
          { path: "/advertise", changefreq: "monthly", priority: "0.6" },
          { path: "/affiliate", changefreq: "monthly", priority: "0.5" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("blog_posts")
            .select("slug, status")
            .eq("status", "published")
            .limit(1000);
          for (const row of data ?? []) {
            const slug = (row as { slug?: unknown }).slug;
            if (typeof slug === "string" && slug) {
              entries.push({ path: `/blog/${slug}`, changefreq: "monthly", priority: "0.7" });
            }
          }
        } catch {
          // published routes still ship without dynamic entries
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
