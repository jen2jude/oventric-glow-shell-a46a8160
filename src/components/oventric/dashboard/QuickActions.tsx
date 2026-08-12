import { Link } from "@tanstack/react-router";
import { Rss, Target, Store, BookOpen } from "lucide-react";

const ACTIONS = [
  { to: "/", search: { section: "Feed" }, label: "Posts", icon: Rss, hint: "Jump to your feed" },
  {
    to: "/dashboard",
    search: { tab: "creator" },
    label: "Seller Hub",
    icon: Store,
    hint: "Manage your business",
  },
  {
    to: "/",
    search: { section: "Marketplace" },
    label: "Assets",
    icon: Store,
    hint: "Marketplace & listings",
  },
  {
    to: "/blog",
    search: undefined,
    label: "Blog",
    icon: BookOpen,
    hint: "Read & publish articles",
  },
] as const;


export function QuickActions() {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-white/10 md:border-slate-200 bg-[#141418] md:bg-white md:shadow-sm p-2.5"
      aria-label="Quick actions"
    >
      {ACTIONS.map((a) => (
        <Link
          key={a.label}
          to={a.to}
          search={a.search as never}
          className="group flex flex-col items-start gap-2 rounded-xl border border-white/10 md:border-slate-200 bg-white/[0.03] md:bg-slate-50 hover:border-white/20 md:hover:border-slate-300 p-3 transition"
        >
          <span className="w-9 h-9 rounded-[10px] bg-white/5 md:bg-white border border-white/10 md:border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-white/10 md:group-hover:bg-slate-100 transition">
            <a.icon className="w-4 h-4 text-white md:text-slate-900" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white md:text-slate-900 truncate">
              {a.label}
            </span>
            <span className="block text-[11px] text-slate-400 md:text-slate-500 truncate">
              {a.hint}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
