import { Link } from "@tanstack/react-router";
import { useProfileEcosystem } from "@/lib/ecosystem/useProfileEcosystem";
import type { EcosystemSectionKey } from "@/lib/ecosystem/sections";

/**
 * A person chip: avatar + name that always routes back to their Oventric
 * identity. Drop it on products, services, courses, posts and bounties so
 * every entity leads to the human behind it.
 */
export function CreatorChip({
  idOrSlug,
  name,
  avatarUrl,
  caption,
  dark = false,
  className = "",
}: {
  idOrSlug: string;
  name: string;
  avatarUrl?: string | null;
  caption?: string;
  dark?: boolean;
  className?: string;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <Link
      to="/profile/$id"
      params={{ id: idOrSlug }}
      className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${
          dark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
        }`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          initial
        )}
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}
        >
          {name}
        </span>
        {caption ? (
          <span
            className={`block truncate text-[11px] ${dark ? "text-white/50" : "text-slate-500"}`}
          >
            {caption}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Adaptive row of links into the rest of a person's ecosystem
 * (Shop, Services, Courses, Posts…). Sections they don't use are omitted.
 */
export function EcosystemLinks({
  idOrSlug,
  exclude = [],
  dark = false,
  className = "",
}: {
  idOrSlug: string;
  exclude?: EcosystemSectionKey[];
  dark?: boolean;
  className?: string;
}) {
  const { sections } = useProfileEcosystem(idOrSlug);
  const visible = sections.filter(
    (s) => !exclude.includes(s.key) && s.key !== "about" && s.key !== "photos" && (s.count ?? 0) > 0,
  );
  if (!visible.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visible.map((s) => (
        <Link
          key={s.key}
          to="/profile/$id"
          params={{ id: idOrSlug }}
          search={(prev: Record<string, unknown>) => ({ ...prev, tab: s.key, pages: 1, y: 0 })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            dark
              ? "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {s.label}
          <span className={dark ? "text-white/40" : "text-slate-400"}>{s.count}</span>
        </Link>
      ))}
    </div>
  );
}
