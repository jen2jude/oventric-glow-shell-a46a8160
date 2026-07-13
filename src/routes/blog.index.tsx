import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Share2 } from "lucide-react";
import { listBlogPosts, type BlogListItem } from "@/lib/blog.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { PublicChrome } from "@/components/oventric/PublicChrome";
import { ShareSheet } from "@/components/oventric/ShareSheet";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Oventric" },
      { name: "description", content: "Long-form technical writing from the Oventric network." },
      { property: "og:title", content: "Blog — Oventric" },
      { property: "og:description", content: "Long-form technical writing from the Oventric network." },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const listFn = useServerFn(listBlogPosts);
  const [rows, setRows] = useState<BlogListItem[] | null>(null);
  useEffect(() => { listFn().then((r) => setRows(r.posts)).catch(() => setRows([])); }, [listFn]);

  return (
    <PublicChrome>
    <div className="min-h-screen bg-[#0b0b0d] text-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-10">

        <header className="mb-8">
          <h1 className="text-white text-4xl font-black">The Oventric Blog</h1>
          <p className="text-slate-400 mt-2">Deep dives, playbooks, and lessons from the network.</p>
        </header>
        {!rows ? (
          <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-500 p-12">No articles published yet. Check back soon.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => (
              <Link
                key={p.id}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="group bg-[#141418] border border-white/10 rounded-xl overflow-hidden hover:border-emerald-500/40 transition"
              >
                <div className="aspect-video bg-black/50 overflow-hidden">
                  {p.cover_url ? (
                    <ResponsiveImage sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  ) : null}
                </div>
                <div className="p-4">
                  {p.category_name && (
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">
                      Blog · {p.category_name}
                    </div>
                  )}
                  <h2 className="text-white font-bold leading-tight line-clamp-2">{p.title}</h2>
                  <p className="mt-2 text-sm text-slate-400 line-clamp-3">{p.excerpt}</p>
                  <div className="mt-3 text-[11px] text-slate-500">
                    {p.author_name} · {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
    </PublicChrome>
  );
}
