import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { listBlogAdmin, deleteBlogPost, type BlogAdminRow } from "@/lib/blog.functions";
import { ResponsiveImage } from "@/components/ui/responsive-image";

export const Route = createFileRoute("/admin/blog/")({
  head: () => ({
    meta: [{ title: "Blog · Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: BlogListPage,
});

function BlogListPage() {
  const listFn = useServerFn(listBlogAdmin);
  const delFn = useServerFn(deleteBlogPost);
  const [rows, setRows] = useState<BlogAdminRow[] | null>(null);
  const refresh = useCallback(() => {
    listFn().then((r) => setRows(r.rows));
  }, [listFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const pill = (s: BlogAdminRow["status"]) => {
    const map = {
      published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      draft: "bg-white/5 text-slate-300 border-white/20",
      scheduled: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    } as const;
    return (
      <span
        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${map[s]}`}
      >
        {s}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Blog</h1>
          <p className="text-sm text-slate-400">{rows?.length ?? 0} posts</p>
        </div>
        <Link
          to="/admin/blog/$id"
          params={{ id: "new" }}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400"
        >
          <Plus className="w-4 h-4" /> New post
        </Link>
      </header>

      {!rows ? (
        <div className="flex justify-center mt-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center mt-10">No blog posts yet.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-[#141418] border border-white/10 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-16 h-16 shrink-0 rounded-[10px] overflow-hidden bg-black/40 border border-white/10">
                {r.cover_url ? (
                  <ResponsiveImage
                    sizes="96px"
                    src={r.cover_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {pill(r.status)}
                  {r.category_name && (
                    <span className="text-[10px] text-slate-400">/ {r.category_name}</span>
                  )}
                </div>
                <div className="text-white font-bold truncate">{r.title}</div>
                <div className="text-xs text-slate-500 truncate">
                  /{r.slug} · updated {new Date(r.updated_at).toLocaleDateString()}
                </div>
              </div>
              <Link
                to="/admin/blog/$id"
                params={{ id: r.id }}
                className="px-3 py-1.5 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </Link>
              <button
                onClick={async () => {
                  if (confirm("Delete this post?")) {
                    await delFn({ data: { id: r.id } });
                    refresh();
                  }
                }}
                className="p-2 rounded-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
