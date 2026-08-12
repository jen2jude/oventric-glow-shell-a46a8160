import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Coins,
  GraduationCap,
  Languages as LanguagesIcon,
  Loader2,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  getProfileAbout,
  saveMyAbout,
  type AboutEntry,
  type ProfileAbout,
} from "@/lib/profile-about.functions";

interface Props {
  idOrSlug: string;
  name: string;
  isOwner: boolean;
  /** Converts a USD amount into the viewer's display currency. */
  price: (usd: number) => string;
}

const CARD =
  "rounded-2xl border border-white/10 bg-[#141418] md:border-slate-200 md:bg-white md:shadow-sm";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-black text-white md:text-slate-900">{children}</h2>
  );
}

/** One tile in the horizontal achievement rail. */
function StatTile({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`${CARD} w-[132px] shrink-0 snap-start px-3 py-4 text-center`}
    >
      <Icon className="mx-auto h-4 w-4 text-[#E5484D]" />
      <p className="mt-2 truncate text-xl font-black text-white md:text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-400 md:text-slate-500">
        {label}
      </p>
    </div>
  );
}

function EntryRow({
  entry,
  icon: Icon,
}: {
  entry: AboutEntry;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.06] py-3 last:border-0 md:border-slate-100">
      <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] md:bg-slate-100">
        <Icon className="h-4 w-4 text-[#E5484D]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white md:text-slate-900">{entry.title}</p>
        {entry.subtitle ? (
          <p className="text-xs text-slate-400 md:text-slate-500">{entry.subtitle}</p>
        ) : null}
        {entry.year ? <p className="text-[11px] text-slate-500">{entry.year}</p> : null}
      </div>
    </div>
  );
}

/** Small repeated-entry editor used for education and certifications. */
function EntryEditor({
  title,
  rows,
  onChange,
  placeholder,
}: {
  title: string;
  rows: AboutEntry[];
  onChange: (next: AboutEntry[]) => void;
  placeholder: [string, string, string];
}) {
  const update = (i: number, patch: Partial<AboutEntry>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{title}</p>
        <button
          type="button"
          onClick={() => onChange([...rows, { title: "", subtitle: "", year: "" }])}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#E5484D]"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="mt-2 space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-[#0F0F12] p-3">
            <div className="flex items-center justify-between gap-2">
              <input
                value={r.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder={placeholder[0]}
                className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                aria-label="Remove entry"
                className="shrink-0 text-slate-500 hover:text-[#E5484D]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input
              value={r.subtitle ?? ""}
              onChange={(e) => update(i, { subtitle: e.target.value })}
              placeholder={placeholder[1]}
              className="mt-2 w-full bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600"
            />
            <input
              value={r.year ?? ""}
              onChange={(e) => update(i, { year: e.target.value })}
              placeholder={placeholder[2]}
              className="mt-1 w-full bg-transparent text-[11px] text-slate-400 outline-none placeholder:text-slate-600"
            />
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-slate-500">Nothing added yet.</p>
        )}
      </div>
    </div>
  );
}

/**
 * About tab: the person's story, a scrollable rail of every achievement they
 * have earned on Oventric, plus credentials they add themselves.
 */
export function ProfileAboutTab({ idOrSlug, name, isOwner, price }: Props) {
  const load = useServerFn(getProfileAbout);
  const save = useServerFn(saveMyAbout);
  const [data, setData] = useState<ProfileAbout | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [education, setEducation] = useState<AboutEntry[]>([]);
  const [certifications, setCertifications] = useState<AboutEntry[]>([]);
  const [languages, setLanguages] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await load({ data: { idOrSlug } });
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idOrSlug, load]);

  useEffect(() => {
    if (!editing) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [editing]);

  const openEditor = () => {
    setEducation(data?.education ?? []);
    setCertifications(data?.certifications ?? []);
    setLanguages((data?.languages ?? []).join(", "));
    setEditing(true);
  };

  const persist = async () => {
    setBusy(true);
    try {
      const payload = {
        education: education.filter((e) => e.title.trim()),
        certifications: certifications.filter((e) => e.title.trim()),
        languages: languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 12),
      };
      await save({ data: payload });
      setData((prev) => (prev ? { ...prev, ...payload } : prev));
      setEditing(false);
      toast.success("About updated");
    } catch {
      toast.error("Couldn't save your about details");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  const s = data.stats;
  const first = name.split(" ")[0] || name;

  // Only surface achievements the person actually has, so the rail stays
  // meaningful instead of a wall of zeroes.
  const tiles: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { value: `${s.yearsOnPlatform}+`, label: "Years on Oventric", icon: Sparkles, keep: true },
      { value: `${s.projectsCompleted}`, label: "Projects completed", icon: Briefcase },
      { value: `${s.happyClients}`, label: "Happy clients", icon: Users },
      { value: `${s.bountiesSolved}`, label: "Bounties solved", icon: Target },
      { value: `${s.bountiesPosted}`, label: "Bounties posted", icon: Target },
      { value: `${s.productsSold}`, label: "Products sold", icon: ShoppingBag },
      { value: `${s.servicesRendered}`, label: "Services rendered", icon: Briefcase },
      { value: `${s.coursesSold}`, label: "Courses sold", icon: GraduationCap },
      { value: `${s.coursesCompleted}`, label: "Courses completed", icon: BookOpen },
      { value: `${s.productsListed}`, label: "Products listed", icon: ShoppingBag },
      { value: `${s.servicesListed}`, label: "Services listed", icon: Briefcase },
      { value: `${s.postsPublished}`, label: "Posts published", icon: Sparkles },
      { value: `${s.followers}`, label: "Followers", icon: Users },
      { value: `${s.communities}`, label: "Communities", icon: Users },
      { value: price(data.earnedUsd), label: "Earned on Oventric", icon: Coins },
    ]
      .filter((t) => (t as { keep?: boolean }).keep || t.value !== "0")
      .map(({ value, label, icon }) => ({ value, label, icon }));

  return (
    <div data-testid="profile-about" className="space-y-6 pb-4">
      {/* My Story */}
      <section>
        <div className="flex items-center justify-between">
          <SectionTitle>My Story</SectionTitle>
          {isOwner && (
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#E5484D]"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit details
            </button>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-300 md:text-slate-600">
          {data.story?.trim() ||
            (isOwner
              ? "Add a bio in your profile settings to tell people what you do."
              : `${first} hasn't added a story yet.`)}
        </p>
      </section>

      {/* Achievements rail */}
      <section>
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
          {tiles.map((t) => (
            <StatTile key={t.label} value={t.value} label={t.label} icon={t.icon} />
          ))}
        </div>
      </section>

      {/* Education */}
      {(data.education.length > 0 || isOwner) && (
        <section>
          <SectionTitle>Education</SectionTitle>
          <div className={`${CARD} mt-3 px-4`}>
            {data.education.length > 0 ? (
              data.education.map((e, i) => <EntryRow key={i} entry={e} icon={GraduationCap} />)
            ) : (
              <p className="py-4 text-xs text-slate-500">
                Add your schools and degrees so buyers know your background.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Certifications */}
      {(data.certifications.length > 0 || isOwner) && (
        <section>
          <SectionTitle>Certifications</SectionTitle>
          <div className={`${CARD} mt-3 px-4`}>
            {data.certifications.length > 0 ? (
              data.certifications.map((e, i) => <EntryRow key={i} entry={e} icon={Award} />)
            ) : (
              <p className="py-4 text-xs text-slate-500">
                Add certificates and credentials you've earned.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Languages */}
      {data.languages.length > 0 && (
        <section>
          <SectionTitle>Languages</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.languages.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-slate-200 md:border-slate-200 md:bg-slate-50 md:text-slate-700"
              >
                <LanguagesIcon className="h-3.5 w-3.5 text-[#E5484D]" />
                {l}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Trust + member since */}
      <section>
        <SectionTitle>On Oventric</SectionTitle>
        <div className={`${CARD} mt-3 px-4`}>
          <EntryRow
            entry={{
              title: "Member since",
              subtitle: data.joined
                ? new Date(data.joined).toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })
                : "—",
            }}
            icon={BadgeCheck}
          />
          <EntryRow
            entry={{
              title: "Lifetime earnings",
              subtitle: `${price(data.earnedUsd)} across products, services, courses and bounties`,
            }}
            icon={Coins}
          />
        </div>
      </section>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 md:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141418] p-5 md:rounded-3xl">
            <div className="flex items-center justify-between">
              <p className="text-base font-black text-white">Edit about</p>
              <button type="button" onClick={() => setEditing(false)} aria-label="Close">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <EntryEditor
                title="Education"
                rows={education}
                onChange={setEducation}
                placeholder={["B.Sc. Computer Science", "University of Lagos", "2018 — 2022"]}
              />
              <EntryEditor
                title="Certifications"
                rows={certifications}
                onChange={setCertifications}
                placeholder={["Google UX Design Professional", "Coursera", "2024"]}
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Languages
                </p>
                <input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="English, Yoruba, French"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0F0F12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void persist()}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-[#E5484D] py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
